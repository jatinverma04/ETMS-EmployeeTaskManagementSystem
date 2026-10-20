process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/etms_phase5_task_delete_test';
process.env.PORT = '5005';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const Employee = require('../src/models/Employee');
const Task = require('../src/models/Task');
const AppError = require('../src/utils/AppError');
const { createEmployeeSnapshot } = require('../src/utils/employeeSnapshot');
const {
  connectTestDatabase,
  clearTestCollections,
  disconnectTestDatabase,
} = require('./helpers/testDatabase');
const { validEmployee, validTask } = require('./helpers/fixtures');

let server;
let baseUrl;

function startServer() {
  return new Promise((resolve, reject) => {
    const httpServer = http.createServer(app);
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      httpServer.removeListener('error', reject);
      resolve(httpServer);
    });
  });
}

function stopServer(httpServer) {
  return new Promise((resolve, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolve()));
    httpServer.closeAllConnections();
  });
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

function utcDateWithOffset(offsetDays) {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function employeeData(index, overrides = {}) {
  const suffix = String(index).padStart(3, '0');

  return validEmployee({
    employeeId: `EMP-${suffix}`,
    fullName: `Employee ${suffix}`,
    email: `employee${suffix}@example.com`,
    ...overrides,
  });
}

async function createEmployee(overrides = {}) {
  return Employee.create(validEmployee(overrides));
}

function taskPayload(employeeId, overrides = {}) {
  return {
    title: 'Delete task',
    description: 'Task deletion coverage.',
    assignedEmployee: String(employeeId),
    department: 'Development',
    priority: 'High',
    startDate: utcDateWithOffset(0),
    dueDate: utcDateWithOffset(7),
    ...overrides,
  };
}

async function createTaskViaApi(employeeId, overrides = {}) {
  return apiRequest('/tasks', {
    method: 'POST',
    body: taskPayload(employeeId, overrides),
  });
}

async function storedActiveCount(employeeId) {
  const employee = await Employee.findById(employeeId)
    .select('+activeTaskCount')
    .lean();

  return employee?.activeTaskCount;
}

describe('Task deletion', () => {
  before(async () => {
    await connectTestDatabase();
    server = await startServer();
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    if (server) {
      await stopServer(server);
    }

    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await clearTestCollections();
  });

  it('deletes active tasks transactionally and frees capacity', async () => {
    const employee = await createEmployee();

    for (let index = 1; index <= 3; index += 1) {
      const response = await createTaskViaApi(employee._id, {
        title: `Capacity task ${index}`,
      });

      assert.equal(response.status, 201);
    }

    assert.equal(await storedActiveCount(employee._id), 3);

    const tasks = await Task.find({ assignedEmployee: employee._id })
      .sort({ taskId: 1 })
      .lean();
    const deletedTask = tasks[0];

    const deletion = await apiRequest(`/tasks/${deletedTask._id}`, {
      method: 'DELETE',
    });

    assert.equal(deletion.status, 204);
    assert.equal(deletion.body, null);
    assert.equal(await Task.findById(deletedTask._id), null);
    assert.equal(await storedActiveCount(employee._id), 2);

    const detail = await apiRequest(`/tasks/${deletedTask._id}`);
    assert.equal(detail.status, 404);

    const replacement = await createTaskViaApi(employee._id, {
      title: 'Replacement after deletion',
    });

    assert.equal(replacement.status, 201);
    assert.equal(await storedActiveCount(employee._id), 3);
    assert.equal(await Task.countDocuments({ assignedEmployee: employee._id }), 3);
  });

  it('deletes terminal tasks without changing the active-task counter', async () => {
    const employee = await createEmployee();

    const completed = await Task.create(
      validTask({
        taskId: 'TSK-301',
        title: 'Completed task',
        assignedEmployee: employee._id,
        employeeSnapshot: createEmployeeSnapshot(employee),
        status: 'Completed',
        completedDate: new Date(),
        startDate: utcDateWithOffset(-2),
        dueDate: utcDateWithOffset(-1),
      }),
    );
    const cancelled = await Task.create(
      validTask({
        taskId: 'TSK-302',
        title: 'Cancelled task',
        assignedEmployee: employee._id,
        employeeSnapshot: createEmployeeSnapshot(employee),
        status: 'Cancelled',
        startDate: utcDateWithOffset(-2),
        dueDate: utcDateWithOffset(-1),
      }),
    );

    assert.equal(await storedActiveCount(employee._id), 0);

    for (const task of [completed, cancelled]) {
      const response = await apiRequest(`/tasks/${task._id}`, {
        method: 'DELETE',
      });

      assert.equal(response.status, 204);
    }

    assert.equal(await storedActiveCount(employee._id), 0);
    assert.equal(await Task.countDocuments(), 0);
  });

  it('returns 400/404 for invalid IDs and rolls back the counter when deletion fails', async () => {
    const invalid = await apiRequest('/tasks/not-an-object-id', {
      method: 'DELETE',
    });
    const missing = await apiRequest('/tasks/000000000000000000000000', {
      method: 'DELETE',
    });

    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.errors.some((error) => error.field === 'id'), true);
    assert.equal(missing.status, 404);

    const employee = await createEmployee();
    const created = await createTaskViaApi(employee._id);

    assert.equal(created.status, 201);
    assert.equal(await storedActiveCount(employee._id), 1);

    const originalDeleteOne = Task.deleteOne;

    Task.deleteOne = async function patchedDeleteOne(...args) {
      await originalDeleteOne.apply(this, args);
      throw new AppError('Forced task deletion failure.', 409);
    };

    try {
      const failedDeletion = await apiRequest(`/tasks/${created.body.data.id}`, {
        method: 'DELETE',
      });

      assert.equal(failedDeletion.status, 409);
    } finally {
      Task.deleteOne = originalDeleteOne;
    }

    assert.ok(await Task.findById(created.body.data.id));
    assert.equal(await storedActiveCount(employee._id), 1);
  });
});
