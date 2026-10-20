process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/etms_phase4_test';
process.env.PORT = '5002';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Types } = require('mongoose');
const app = require('../src/app');
const Employee = require('../src/models/Employee');
const Task = require('../src/models/Task');
const AppError = require('../src/utils/AppError');
const { createEmployeeSnapshot } = require('../src/utils/employeeSnapshot');
const { ACTIVE_TASK_STATUSES } = require('../src/constants/domain');
const {
  reconcileActiveTaskCounts,
} = require('../src/services/capacityReconciliation.service');
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

function hasErrorField(response, field) {
  return Boolean(
    response.body?.errors?.some((error) => error.field === field),
  );
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

function utcDateWithOffset(offsetDays) {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function taskPayload(employeeId, overrides = {}) {
  return {
    title: 'Build task API',
    description: 'Implement the task creation endpoint.',
    assignedEmployee: String(employeeId),
    department: 'Development',
    priority: 'High',
    startDate: utcDateWithOffset(0),
    dueDate: utcDateWithOffset(7),
    ...overrides,
  };
}

async function createEmployee(overrides = {}) {
  return Employee.create(validEmployee(overrides));
}

async function createTaskViaApi(employeeId, overrides = {}) {
  return apiRequest('/tasks', {
    method: 'POST',
    body: taskPayload(employeeId, overrides),
  });
}

async function createDirectTask(employee, overrides = {}) {
  return Task.create(
    validTask({
      assignedEmployee: employee._id,
      employeeSnapshot: createEmployeeSnapshot(employee),
      ...overrides,
    }),
  );
}

async function storedActiveCount(employeeId) {
  const employee = await Employee.findById(employeeId)
    .select('+activeTaskCount')
    .lean();

  return employee?.activeTaskCount;
}

function forceTaskSaveFailure({ afterSave }) {
  const originalSave = Task.prototype.save;

  Task.prototype.save = async function patchedSave(...args) {
    if (afterSave) {
      await originalSave.apply(this, args);
    }

    throw new AppError('Forced transaction failure.', 409);
  };

  return () => {
    Task.prototype.save = originalSave;
  };
}

describe('Task API', () => {
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

  it('creates a Todo task with a backend Task ID, snapshot, and capacity count', async () => {
    const employee = await createEmployee();
    const response = await createTaskViaApi(employee._id, {
      title: '  Build task API  ',
    });

    assert.equal(response.status, 201);
    assert.ok(response.body.data.id);
    assert.equal(response.body.data.taskId, 'TSK-001');
    assert.equal(response.body.data.title, 'Build task API');
    assert.equal(response.body.data.status, 'Todo');
    assert.equal(response.body.data.completedDate, null);
    assert.equal(response.body.data.assignedEmployee, String(employee._id));
    assert.equal(response.body.data.isOverdue, false);
    assert.equal('activeTaskCount' in response.body.data, false);
    assert.ok(response.body.data.createdAt);
    assert.deepEqual(response.body.data.employeeSnapshot, {
      employeeId: 'EMP-001',
      fullName: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      department: 'Development',
    });
    assert.equal(await storedActiveCount(employee._id), 1);

    const detail = await apiRequest(`/tasks/${response.body.data.id}`);

    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.taskId, 'TSK-001');
    assert.deepEqual(detail.body.data.employeeSnapshot, response.body.data.employeeSnapshot);
    assert.equal(detail.body.data.isOverdue, false);
  });

  it('rejects protected fields, malformed input, and invalid date ranges without partial writes', async () => {
    const employee = await createEmployee();
    const protectedFields = {
      taskId: 'TSK-999',
      status: 'Completed',
      completedDate: '2024-06-01',
      createdAt: new Date().toISOString(),
      employeeSnapshot: {
        employeeId: 'EMP-999',
        fullName: 'Fake Employee',
        email: 'fake@example.com',
        department: 'Development',
      },
      activeTaskCount: 5,
    };

    for (const [field, value] of Object.entries(protectedFields)) {
      const response = await apiRequest('/tasks', {
        method: 'POST',
        body: { ...taskPayload(employee._id), [field]: value },
      });

      assert.equal(response.status, 400, `Expected 400 for protected field ${field}`);
      assert.equal(hasErrorField(response, field), true, `Missing error for ${field}`);
    }

    const missing = await apiRequest('/tasks', { method: 'POST', body: {} });

    assert.equal(missing.status, 400);
    for (const field of [
      'title',
      'description',
      'assignedEmployee',
      'department',
      'priority',
      'startDate',
      'dueDate',
    ]) {
      assert.equal(hasErrorField(missing, field), true, `Missing error for ${field}`);
    }

    const arrayBody = await apiRequest('/tasks', { method: 'POST', body: [] });
    assert.equal(arrayBody.status, 400);
    assert.equal(hasErrorField(arrayBody, 'body'), true);

    const invalid = await apiRequest('/tasks', {
      method: 'POST',
      body: taskPayload(employee._id, {
        title: 'AB',
        description: '',
        assignedEmployee: 'not-an-object-id',
        department: 'Marketing',
        priority: 'Urgent',
        startDate: '2024-02-30',
        dueDate: 'not-a-date',
      }),
    });

    assert.equal(invalid.status, 400);
    for (const field of [
      'title',
      'description',
      'assignedEmployee',
      'department',
      'priority',
      'startDate',
      'dueDate',
    ]) {
      assert.equal(hasErrorField(invalid, field), true, `Missing error for ${field}`);
    }

    const invalidRange = await createTaskViaApi(employee._id, {
      startDate: '2024-06-10',
      dueDate: '2024-06-09',
    });

    assert.equal(invalidRange.status, 400);
    assert.equal(hasErrorField(invalidRange, 'dueDate'), true);
    assert.equal(await Task.countDocuments(), 0);
    assert.equal(await storedActiveCount(employee._id), 0);
  });

  it('enforces Active, Inactive, and inclusive On Leave assignment boundaries', async () => {
    const inactive = await createEmployee({
      employeeId: 'EMP-002',
      email: 'inactive@example.com',
      status: 'Inactive',
    });
    const inactiveResponse = await createTaskViaApi(inactive._id);

    assert.equal(inactiveResponse.status, 400);
    assert.equal(hasErrorField(inactiveResponse, 'assignedEmployee'), true);
    assert.equal(await storedActiveCount(inactive._id), 0);

    const onLeave = await createEmployee({
      employeeId: 'EMP-003',
      email: 'leave@example.com',
      status: 'On Leave',
      leaveStart: '2024-06-10',
      leaveEnd: '2024-06-14',
    });

    for (const startDate of ['2024-06-10', '2024-06-11', '2024-06-14']) {
      const response = await createTaskViaApi(onLeave._id, {
        startDate,
        dueDate: '2024-06-20',
      });

      assert.equal(response.status, 400, `Expected leave conflict on ${startDate}`);
      assert.equal(hasErrorField(response, 'startDate'), true);
    }

    assert.equal(await storedActiveCount(onLeave._id), 0);

    for (const startDate of ['2024-06-09', '2024-06-15']) {
      const response = await createTaskViaApi(onLeave._id, {
        startDate,
        dueDate: '2024-06-20',
      });

      assert.equal(response.status, 201, `Expected assignment outside leave on ${startDate}`);
    }

    assert.equal(await storedActiveCount(onLeave._id), 2);

    const missing = await createTaskViaApi(new Types.ObjectId());
    assert.equal(missing.status, 404);
  });

  it('enforces three active tasks and frees capacity after cancellation', async () => {
    const employee = await createEmployee();
    const created = [];

    for (let index = 1; index <= 3; index += 1) {
      const response = await createTaskViaApi(employee._id, {
        title: `Capacity task ${index}`,
      });

      assert.equal(response.status, 201);
      created.push(response.body.data);
    }

    const fourth = await createTaskViaApi(employee._id, {
      title: 'Fourth task',
    });

    assert.equal(fourth.status, 409);
    assert.equal(hasErrorField(fourth, 'assignedEmployee'), true);
    assert.equal(await storedActiveCount(employee._id), 3);
    assert.equal(await Task.countDocuments({ assignedEmployee: employee._id }), 3);

    const cancel = await apiRequest(`/tasks/${created[0].id}/status`, {
      method: 'PUT',
      body: { status: 'Cancelled' },
    });

    assert.equal(cancel.status, 200);
    assert.equal(cancel.body.data.status, 'Cancelled');
    assert.equal(cancel.body.data.completedDate, null);
    assert.equal(await storedActiveCount(employee._id), 2);

    const replacement = await createTaskViaApi(employee._id, {
      title: 'Replacement task',
    });

    assert.equal(replacement.status, 201);
    assert.equal(await storedActiveCount(employee._id), 3);
    assert.equal(
      await Task.countDocuments({
        assignedEmployee: employee._id,
        status: { $in: ACTIVE_TASK_STATUSES },
      }),
      3,
    );
    assert.equal(await Task.countDocuments({ assignedEmployee: employee._id }), 4);
  });

  it('lists tasks with pagination, snapshot search, combined filters, due ranges, and sorting', async () => {
    const employeeA = await createEmployee(employeeData(1, { fullName: 'Aarav Sharma' }));
    const employeeB = await createEmployee(
      employeeData(2, { fullName: 'Zara Khan', department: 'Design' }),
    );

    await Task.create([
      validTask({
        taskId: 'TSK-101',
        title: 'Alpha',
        assignedEmployee: employeeA._id,
        employeeSnapshot: createEmployeeSnapshot(employeeA),
        department: 'Development',
        priority: 'Low',
        status: 'Todo',
        startDate: '2024-06-01',
        dueDate: '2024-06-10',
      }),
      validTask({
        taskId: 'TSK-102',
        title: 'Bravo',
        assignedEmployee: employeeA._id,
        employeeSnapshot: createEmployeeSnapshot(employeeA),
        department: 'Development',
        priority: 'Critical',
        status: 'In Progress',
        startDate: '2024-06-01',
        dueDate: '2024-06-11',
      }),
      validTask({
        taskId: 'TSK-103',
        title: 'Charlie',
        assignedEmployee: employeeB._id,
        employeeSnapshot: createEmployeeSnapshot(employeeB),
        department: 'Design',
        priority: 'Medium',
        status: 'Completed',
        completedDate: new Date('2024-06-12T12:00:00.000Z'),
        startDate: '2024-06-01',
        dueDate: '2024-06-12',
      }),
      validTask({
        taskId: 'TSK-104',
        title: 'Delta',
        assignedEmployee: employeeB._id,
        employeeSnapshot: createEmployeeSnapshot(employeeB),
        department: 'Design',
        priority: 'High',
        status: 'Cancelled',
        startDate: '2024-06-01',
        dueDate: '2024-06-13',
      }),
    ]);

    const titleSearch = await apiRequest('/tasks?search=alpha');
    assert.equal(titleSearch.status, 200);
    assert.equal(titleSearch.body.pagination.total, 1);
    assert.equal(titleSearch.body.data[0].title, 'Alpha');

    const snapshotSearch = await apiRequest('/tasks?search=ZARA');
    assert.equal(snapshotSearch.status, 200);
    assert.equal(snapshotSearch.body.pagination.total, 2);
    assert.equal(
      snapshotSearch.body.data.every(
        (task) => task.employeeSnapshot.fullName === 'Zara Khan',
      ),
      true,
    );

    const regexInput = await apiRequest('/tasks?search=.*');
    assert.equal(regexInput.status, 200);
    assert.equal(regexInput.body.pagination.total, 0);

    const combined = await apiRequest(
      '/tasks?department=Design&priority=Medium&status=Completed',
    );
    assert.equal(combined.status, 200);
    assert.equal(combined.body.pagination.total, 1);
    assert.equal(combined.body.data[0].taskId, 'TSK-103');

    const dueRange = await apiRequest(
      '/tasks?dueFrom=2024-06-11&dueTo=2024-06-12',
    );
    assert.equal(dueRange.status, 200);
    assert.equal(dueRange.body.pagination.total, 2);
    assert.deepEqual(
      dueRange.body.data.map((task) => task.taskId).sort(),
      ['TSK-102', 'TSK-103'],
    );

    const dueFromOnly = await apiRequest('/tasks?dueFrom=2024-06-11');
    assert.equal(dueFromOnly.status, 200);
    assert.equal(dueFromOnly.body.pagination.total, 3);

    const dueToOnly = await apiRequest('/tasks?dueTo=2024-06-11');
    assert.equal(dueToOnly.status, 200);
    assert.equal(dueToOnly.body.pagination.total, 2);

    const titleAsc = await apiRequest('/tasks?sort=title&order=asc');
    assert.equal(titleAsc.status, 200);
    assert.deepEqual(
      titleAsc.body.data.map((task) => task.title),
      ['Alpha', 'Bravo', 'Charlie', 'Delta'],
    );

    const priorityDesc = await apiRequest('/tasks?sort=priority');
    assert.equal(priorityDesc.status, 200);
    assert.deepEqual(
      priorityDesc.body.data.map((task) => task.priority),
      ['Critical', 'High', 'Medium', 'Low'],
    );

    const priorityAsc = await apiRequest('/tasks?sort=priority&order=asc');
    assert.equal(priorityAsc.status, 200);
    assert.deepEqual(
      priorityAsc.body.data.map((task) => task.priority),
      ['Low', 'Medium', 'High', 'Critical'],
    );

    const dueDateDesc = await apiRequest('/tasks?sort=dueDate&order=desc');
    assert.equal(dueDateDesc.status, 200);
    assert.deepEqual(
      dueDateDesc.body.data.map((task) => task.dueDate),
      ['2024-06-13', '2024-06-12', '2024-06-11', '2024-06-10'],
    );

    const pageTwo = await apiRequest('/tasks?sort=title&order=asc&page=2&limit=2');
    assert.equal(pageTwo.status, 200);
    assert.deepEqual(
      pageTwo.body.data.map((task) => task.title),
      ['Charlie', 'Delta'],
    );
    assert.deepEqual(pageTwo.body.pagination, {
      page: 2,
      limit: 2,
      total: 4,
      totalPages: 2,
    });

    const createdAtSort = await apiRequest('/tasks?sort=createdAt&order=asc');
    assert.equal(createdAtSort.status, 200);
    assert.equal(createdAtSort.body.pagination.total, 4);

    const defaultList = await apiRequest('/tasks');
    assert.equal(defaultList.status, 200);
    assert.equal(defaultList.body.pagination.total, 4);

    const invalidQueries = [
      { path: '/tasks?page=0', field: 'page' },
      { path: '/tasks?limit=101', field: 'limit' },
      { path: '/tasks?sort=description', field: 'sort' },
      { path: '/tasks?department=Marketing', field: 'department' },
      { path: '/tasks?dueFrom=2024-06-12&dueTo=2024-06-11', field: 'dueFrom' },
      { path: '/tasks?search%5B%24regex%5D=.*', field: 'search' },
      { path: '/tasks?page=1&page=2', field: 'page' },
      { path: '/tasks?export=csv', field: 'export' },
    ];

    for (const { path, field } of invalidQueries) {
      const response = await apiRequest(path);

      assert.equal(response.status, 400, `Expected 400 for ${path}`);
      assert.equal(hasErrorField(response, field), true, `Missing error for ${path}`);
    }
  });

  it('uses UTC date-only overdue boundaries in list and detail responses', async () => {
    const employee = await createEmployee();
    const yesterday = utcDateWithOffset(-1);
    const today = utcDateWithOffset(0);
    const tomorrow = utcDateWithOffset(1);

    const overdue = await createDirectTask(employee, {
      taskId: 'TSK-201',
      title: 'Overdue task',
      status: 'Todo',
      startDate: yesterday,
      dueDate: yesterday,
    });
    const dueToday = await createDirectTask(employee, {
      taskId: 'TSK-202',
      title: 'Due today',
      status: 'Todo',
      startDate: today,
      dueDate: today,
    });
    const dueTomorrow = await createDirectTask(employee, {
      taskId: 'TSK-203',
      title: 'Due tomorrow',
      status: 'In Progress',
      startDate: today,
      dueDate: tomorrow,
    });
    const completed = await createDirectTask(employee, {
      taskId: 'TSK-204',
      title: 'Completed late',
      status: 'Completed',
      completedDate: new Date(),
      startDate: yesterday,
      dueDate: yesterday,
    });

    const detailOverdue = await apiRequest(`/tasks/${overdue._id}`);
    const detailToday = await apiRequest(`/tasks/${dueToday._id}`);
    const detailTomorrow = await apiRequest(`/tasks/${dueTomorrow._id}`);
    const detailCompleted = await apiRequest(`/tasks/${completed._id}`);

    assert.equal(detailOverdue.body.data.isOverdue, true);
    assert.equal(detailToday.body.data.isOverdue, false);
    assert.equal(detailTomorrow.body.data.isOverdue, false);
    assert.equal(detailCompleted.body.data.isOverdue, false);

    const list = await apiRequest('/tasks?sort=title&order=asc');
    const overdueById = new Map(
      list.body.data.map((task) => [task.taskId, task.isOverdue]),
    );

    assert.equal(overdueById.get('TSK-201'), true);
    assert.equal(overdueById.get('TSK-202'), false);
    assert.equal(overdueById.get('TSK-203'), false);
    assert.equal(overdueById.get('TSK-204'), false);
  });

  it('returns 404 for missing tasks and 400 for malformed task IDs', async () => {
    const missing = await apiRequest('/tasks/000000000000000000000000');
    assert.equal(missing.status, 404);

    const invalid = await apiRequest('/tasks/not-an-object-id');
    assert.equal(invalid.status, 400);
    assert.equal(hasErrorField(invalid, 'id'), true);

    const missingUpdate = await apiRequest('/tasks/000000000000000000000000', {
      method: 'PUT',
      body: { title: 'Missing task' },
    });
    assert.equal(missingUpdate.status, 404);

    const invalidUpdate = await apiRequest('/tasks/not-an-object-id', {
      method: 'PUT',
      body: { title: 'Invalid task' },
    });
    assert.equal(invalidUpdate.status, 400);
    assert.equal(hasErrorField(invalidUpdate, 'id'), true);
  });

  it('updates editable fields, preserves snapshots, and reassigns capacity correctly', async () => {
    const employeeA = await createEmployee(
      employeeData(1, { fullName: 'Aarav Sharma' }),
    );
    const employeeB = await createEmployee(
      employeeData(2, { fullName: 'Zara Khan' }),
    );
    const inactive = await createEmployee(
      employeeData(3, {
        fullName: 'Inactive Employee',
        status: 'Inactive',
      }),
    );
    const created = await createTaskViaApi(employeeA._id);

    assert.equal(created.status, 201);
    const taskId = created.body.data.id;

    const partialUpdate = await apiRequest(`/tasks/${taskId}`, {
      method: 'PUT',
      body: {
        title: '  Updated title  ',
        description: 'Updated description',
        department: 'Sales',
        priority: 'Critical',
      },
    });

    assert.equal(partialUpdate.status, 200);
    assert.equal(partialUpdate.body.data.title, 'Updated title');
    assert.equal(partialUpdate.body.data.description, 'Updated description');
    assert.equal(partialUpdate.body.data.department, 'Sales');
    assert.equal(partialUpdate.body.data.priority, 'Critical');
    assert.equal(partialUpdate.body.data.taskId, created.body.data.taskId);
    assert.equal(partialUpdate.body.data.status, 'Todo');
    assert.equal(partialUpdate.body.data.employeeSnapshot.fullName, 'Aarav Sharma');
    assert.equal(await storedActiveCount(employeeA._id), 1);
    assert.equal(await storedActiveCount(employeeB._id), 0);

    const renameA = await apiRequest(`/employees/${employeeA._id}`, {
      method: 'PUT',
      body: { fullName: 'Aarav Renamed' },
    });
    assert.equal(renameA.status, 200);

    const oldNameSearch = await apiRequest('/tasks?search=Aarav%20Sharma');
    const newNameSearch = await apiRequest('/tasks?search=Aarav%20Renamed');
    assert.equal(oldNameSearch.body.pagination.total, 1);
    assert.equal(newNameSearch.body.pagination.total, 0);

    const reassigned = await apiRequest(`/tasks/${taskId}`, {
      method: 'PUT',
      body: { assignedEmployee: String(employeeB._id) },
    });

    assert.equal(reassigned.status, 200);
    assert.equal(reassigned.body.data.assignedEmployee, String(employeeB._id));
    assert.deepEqual(reassigned.body.data.employeeSnapshot, {
      employeeId: 'EMP-002',
      fullName: 'Zara Khan',
      email: 'employee002@example.com',
      department: 'Development',
    });
    assert.equal(await storedActiveCount(employeeA._id), 0);
    assert.equal(await storedActiveCount(employeeB._id), 1);

    const renameB = await apiRequest(`/employees/${employeeB._id}`, {
      method: 'PUT',
      body: { fullName: 'Zara Renamed' },
    });
    assert.equal(renameB.status, 200);

    const sameEmployee = await apiRequest(`/tasks/${taskId}`, {
      method: 'PUT',
      body: { assignedEmployee: String(employeeB._id) },
    });

    assert.equal(sameEmployee.status, 200);
    assert.equal(sameEmployee.body.data.employeeSnapshot.fullName, 'Zara Khan');
    assert.equal(await storedActiveCount(employeeB._id), 1);

    const inactiveTarget = await apiRequest(`/tasks/${taskId}`, {
      method: 'PUT',
      body: { assignedEmployee: String(inactive._id) },
    });

    assert.equal(inactiveTarget.status, 400);
    assert.equal(hasErrorField(inactiveTarget, 'assignedEmployee'), true);
    assert.equal(await storedActiveCount(employeeB._id), 1);

    const missingTarget = await apiRequest(`/tasks/${taskId}`, {
      method: 'PUT',
      body: { assignedEmployee: String(new Types.ObjectId()) },
    });

    assert.equal(missingTarget.status, 404);
    assert.equal(await storedActiveCount(employeeB._id), 1);

    const invalidRange = await apiRequest(`/tasks/${taskId}`, {
      method: 'PUT',
      body: { dueDate: utcDateWithOffset(-1) },
    });

    assert.equal(invalidRange.status, 400);
    assert.equal(hasErrorField(invalidRange, 'dueDate'), true);

    const empty = await apiRequest(`/tasks/${taskId}`, {
      method: 'PUT',
      body: {},
    });
    assert.equal(empty.status, 400);
    assert.equal(hasErrorField(empty, 'body'), true);

    const protectedUpdates = {
      taskId: 'TSK-999',
      status: 'Completed',
      completedDate: '2024-06-01',
      employeeSnapshot: {
        employeeId: 'EMP-999',
        fullName: 'Fake Employee',
        email: 'fake@example.com',
        department: 'Development',
      },
      activeTaskCount: 2,
    };

    for (const [field, value] of Object.entries(protectedUpdates)) {
      const response = await apiRequest(`/tasks/${taskId}`, {
        method: 'PUT',
        body: { [field]: value },
      });

      assert.equal(response.status, 400, `Expected 400 for protected update ${field}`);
      assert.equal(hasErrorField(response, field), true, `Missing error for ${field}`);
    }
  });

  it('keeps reassignment atomic when the target is full or a write fails', async () => {
    const employeeA = await createEmployee(employeeData(1));
    const employeeB = await createEmployee(employeeData(2));
    const employeeC = await createEmployee(employeeData(3));
    const source = await createTaskViaApi(employeeA._id);

    assert.equal(source.status, 201);

    for (let index = 1; index <= 3; index += 1) {
      const targetTask = await createTaskViaApi(employeeB._id, {
        title: `Target capacity ${index}`,
      });
      assert.equal(targetTask.status, 201);
    }

    const fullTarget = await apiRequest(`/tasks/${source.body.data.id}`, {
      method: 'PUT',
      body: { assignedEmployee: String(employeeB._id) },
    });

    assert.equal(fullTarget.status, 409);
    assert.equal(hasErrorField(fullTarget, 'assignedEmployee'), true);
    assert.equal(await storedActiveCount(employeeA._id), 1);
    assert.equal(await storedActiveCount(employeeB._id), 3);

    let storedTask = await Task.findById(source.body.data.id).lean();
    assert.equal(String(storedTask.assignedEmployee), String(employeeA._id));
    assert.equal(storedTask.employeeSnapshot.fullName, 'Employee 001');

    const restore = forceTaskSaveFailure({ afterSave: true });

    try {
      const failedReassignment = await apiRequest(`/tasks/${source.body.data.id}`, {
        method: 'PUT',
        body: { assignedEmployee: String(employeeC._id) },
      });

      assert.equal(failedReassignment.status, 409);
    } finally {
      restore();
    }

    assert.equal(await storedActiveCount(employeeA._id), 1);
    assert.equal(await storedActiveCount(employeeC._id), 0);

    storedTask = await Task.findById(source.body.data.id).lean();
    assert.equal(String(storedTask.assignedEmployee), String(employeeA._id));
    assert.equal(storedTask.employeeSnapshot.employeeId, 'EMP-001');
  });

  it('enforces the status transition matrix, Completed Date, and terminal edit locks', async () => {
    const employee = await createEmployee();
    const created = await createTaskViaApi(employee._id);

    assert.equal(created.status, 201);

    const taskId = created.body.data.id;
    const invalidComplete = await apiRequest(`/tasks/${taskId}/status`, {
      method: 'PUT',
      body: { status: 'Completed' },
    });

    assert.equal(invalidComplete.status, 409);
    assert.equal(hasErrorField(invalidComplete, 'status'), true);
    assert.equal(await storedActiveCount(employee._id), 1);

    const sameStatus = await apiRequest(`/tasks/${taskId}/status`, {
      method: 'PUT',
      body: { status: 'Todo' },
    });

    assert.equal(sameStatus.status, 409);

    const inProgress = await apiRequest(`/tasks/${taskId}/status`, {
      method: 'PUT',
      body: { status: 'In Progress' },
    });

    assert.equal(inProgress.status, 200);
    assert.equal(inProgress.body.data.status, 'In Progress');
    assert.equal(inProgress.body.data.completedDate, null);
    assert.equal(await storedActiveCount(employee._id), 1);

    const backToTodo = await apiRequest(`/tasks/${taskId}/status`, {
      method: 'PUT',
      body: { status: 'Todo' },
    });

    assert.equal(backToTodo.status, 409);

    const completed = await apiRequest(`/tasks/${taskId}/status`, {
      method: 'PUT',
      body: { status: 'Completed' },
    });

    assert.equal(completed.status, 200);
    assert.equal(completed.body.data.status, 'Completed');
    assert.match(completed.body.data.completedDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(await storedActiveCount(employee._id), 0);

    const storedCompleted = await Task.findById(taskId).lean();
    assert.ok(storedCompleted.completedDate instanceof Date);
    assert.equal(
      storedCompleted.completedDate.toISOString().slice(0, 10),
      utcDateWithOffset(0),
    );

    const terminalTransition = await apiRequest(`/tasks/${taskId}/status`, {
      method: 'PUT',
      body: { status: 'Cancelled' },
    });

    assert.equal(terminalTransition.status, 409);
    assert.equal(await storedActiveCount(employee._id), 0);

    const editCompleted = await apiRequest(`/tasks/${taskId}`, {
      method: 'PUT',
      body: { title: 'Cannot edit completed' },
    });

    assert.equal(editCompleted.status, 409);

    const second = await createTaskViaApi(employee._id, {
      title: 'Second task',
    });
    assert.equal(second.status, 201);

    const cancelled = await apiRequest(`/tasks/${second.body.data.id}/status`, {
      method: 'PUT',
      body: { status: 'Cancelled' },
    });

    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.data.status, 'Cancelled');
    assert.equal(cancelled.body.data.completedDate, null);
    assert.equal(await storedActiveCount(employee._id), 0);

    const editCancelled = await apiRequest(`/tasks/${second.body.data.id}`, {
      method: 'PUT',
      body: { title: 'Cannot edit cancelled' },
    });

    assert.equal(editCancelled.status, 409);

    const invalidStatuses = [
      { body: {}, field: 'status' },
      { body: { status: 'Unknown' }, field: 'status' },
      {
        body: { status: 'In Progress', completedDate: '2024-06-01' },
        field: 'completedDate',
      },
      {
        body: { status: 'In Progress', taskId: 'TSK-999' },
        field: 'taskId',
      },
    ];

    for (const { body, field } of invalidStatuses) {
      const response = await apiRequest(`/tasks/${taskId}/status`, {
        method: 'PUT',
        body,
      });

      assert.equal(response.status, 400);
      assert.equal(hasErrorField(response, field), true);
    }

    const missingStatus = await apiRequest(
      '/tasks/000000000000000000000000/status',
      {
        method: 'PUT',
        body: { status: 'In Progress' },
      },
    );
    assert.equal(missingStatus.status, 404);

    const invalidStatusId = await apiRequest('/tasks/not-an-object-id/status', {
      method: 'PUT',
      body: { status: 'In Progress' },
    });
    assert.equal(invalidStatusId.status, 400);
    assert.equal(hasErrorField(invalidStatusId, 'id'), true);
  });

  it('rolls back task and counter changes when a transaction write fails', async () => {
    const employee = await createEmployee();

    let restore = forceTaskSaveFailure({ afterSave: false });

    try {
      const beforeInsert = await createTaskViaApi(employee._id);
      assert.equal(beforeInsert.status, 409);
    } finally {
      restore();
    }

    assert.equal(await Task.countDocuments(), 0);
    assert.equal(await storedActiveCount(employee._id), 0);

    restore = forceTaskSaveFailure({ afterSave: true });

    try {
      const afterInsert = await createTaskViaApi(employee._id);
      assert.equal(afterInsert.status, 409);
    } finally {
      restore();
    }

    assert.equal(await Task.countDocuments(), 0);
    assert.equal(await storedActiveCount(employee._id), 0);

    const created = await createTaskViaApi(employee._id);
    assert.equal(created.status, 201);
    assert.equal(await storedActiveCount(employee._id), 1);

    const inProgress = await apiRequest(`/tasks/${created.body.data.id}/status`, {
      method: 'PUT',
      body: { status: 'In Progress' },
    });
    assert.equal(inProgress.status, 200);

    restore = forceTaskSaveFailure({ afterSave: true });

    try {
      const failedStatus = await apiRequest(`/tasks/${created.body.data.id}/status`, {
        method: 'PUT',
        body: { status: 'Completed' },
      });

      assert.equal(failedStatus.status, 409);
    } finally {
      restore();
    }

    const storedTask = await Task.findById(created.body.data.id).lean();
    assert.equal(storedTask.status, 'In Progress');
    assert.equal(storedTask.completedDate, null);
    assert.equal(await storedActiveCount(employee._id), 1);
  });

  it('serializes concurrent task creation so a fourth active task cannot be committed', async () => {
    const employee = await createEmployee();
    const responses = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        createTaskViaApi(employee._id, {
          title: `Concurrent task ${index + 1}`,
        }),
      ),
    );

    assert.equal(responses.filter((response) => response.status === 201).length, 3);
    assert.equal(responses.filter((response) => response.status === 409).length, 1);
    assert.equal(await Task.countDocuments({ assignedEmployee: employee._id }), 3);
    assert.equal(
      await Task.countDocuments({
        assignedEmployee: employee._id,
        status: { $in: ACTIVE_TASK_STATUSES },
      }),
      3,
    );
    assert.equal(await storedActiveCount(employee._id), 3);
  });

  it('serializes concurrent reassignments into the last available capacity slot', async () => {
    const employeeA = await createEmployee(employeeData(1));
    const employeeB = await createEmployee(employeeData(2));

    for (let index = 1; index <= 3; index += 1) {
      const response = await createTaskViaApi(employeeA._id, {
        title: `Source task ${index}`,
      });
      assert.equal(response.status, 201);
    }

    for (let index = 1; index <= 2; index += 1) {
      const response = await createTaskViaApi(employeeB._id, {
        title: `Destination task ${index}`,
      });
      assert.equal(response.status, 201);
    }

    const sourceTasks = await Task.find({
      assignedEmployee: employeeA._id,
    })
      .sort({ taskId: 1 })
      .lean();

    const responses = await Promise.all(
      sourceTasks.map((task) =>
        apiRequest(`/tasks/${task._id}`, {
          method: 'PUT',
          body: { assignedEmployee: String(employeeB._id) },
        }),
      ),
    );

    assert.equal(responses.filter((response) => response.status === 200).length, 1);
    assert.equal(responses.filter((response) => response.status === 409).length, 2);
    assert.equal(await storedActiveCount(employeeA._id), 2);
    assert.equal(await storedActiveCount(employeeB._id), 3);
    assert.equal(
      await Task.countDocuments({
        assignedEmployee: employeeA._id,
        status: { $in: ACTIVE_TASK_STATUSES },
      }),
      2,
    );
    assert.equal(
      await Task.countDocuments({
        assignedEmployee: employeeB._id,
        status: { $in: ACTIVE_TASK_STATUSES },
      }),
      3,
    );
  });

  it('serializes concurrent terminal status changes and decrements capacity once', async () => {
    const employee = await createEmployee();
    const created = await createTaskViaApi(employee._id);

    assert.equal(created.status, 201);

    const inProgress = await apiRequest(`/tasks/${created.body.data.id}/status`, {
      method: 'PUT',
      body: { status: 'In Progress' },
    });
    assert.equal(inProgress.status, 200);

    const responses = await Promise.all([
      apiRequest(`/tasks/${created.body.data.id}/status`, {
        method: 'PUT',
        body: { status: 'Completed' },
      }),
      apiRequest(`/tasks/${created.body.data.id}/status`, {
        method: 'PUT',
        body: { status: 'Cancelled' },
      }),
    ]);

    assert.equal(responses.filter((response) => response.status === 200).length, 1);
    assert.equal(responses.filter((response) => response.status === 409).length, 1);
    assert.equal(await storedActiveCount(employee._id), 0);

    const storedTask = await Task.findById(created.body.data.id).lean();
    assert.ok(['Completed', 'Cancelled'].includes(storedTask.status));
    assert.equal(
      storedTask.status === 'Completed',
      storedTask.completedDate instanceof Date,
    );
  });

  it('keeps employee deletion and task creation mutually consistent under a race', async () => {
    const employee = await createEmployee();
    const [deleteResponse, createResponse] = await Promise.all([
      apiRequest(`/employees/${employee._id}`, { method: 'DELETE' }),
      createTaskViaApi(employee._id),
    ]);

    const storedEmployee = await Employee.findById(employee._id)
      .select('+activeTaskCount')
      .lean();
    const taskCount = await Task.countDocuments({
      assignedEmployee: employee._id,
    });

    if (storedEmployee) {
      assert.equal(deleteResponse.status, 409);
      assert.equal(taskCount, storedEmployee.activeTaskCount);
      if (taskCount > 0) {
        assert.equal(createResponse.status, 201);
      }
    } else {
      assert.equal(deleteResponse.status, 204);
      assert.equal(taskCount, 0);
      assert.ok([404, 409].includes(createResponse.status));
    }
  });

  it('protects employee deletion with active tasks and preserves snapshots after deletion', async () => {
    const employee = await createEmployee();
    const created = await createTaskViaApi(employee._id);

    assert.equal(created.status, 201);

    const blocked = await apiRequest(`/employees/${employee._id}`, {
      method: 'DELETE',
    });

    assert.equal(blocked.status, 409);
    assert.ok(await Employee.findById(employee._id));
    assert.equal(await storedActiveCount(employee._id), 1);

    const inProgress = await apiRequest(`/tasks/${created.body.data.id}/status`, {
      method: 'PUT',
      body: { status: 'In Progress' },
    });
    assert.equal(inProgress.status, 200);

    const completed = await apiRequest(`/tasks/${created.body.data.id}/status`, {
      method: 'PUT',
      body: { status: 'Completed' },
    });
    assert.equal(completed.status, 200);

    const deleted = await apiRequest(`/employees/${employee._id}`, {
      method: 'DELETE',
    });

    assert.equal(deleted.status, 204);
    assert.equal(await Employee.findById(employee._id), null);

    const storedTask = await Task.findById(created.body.data.id).lean();
    assert.ok(storedTask);
    assert.equal(String(storedTask.assignedEmployee), String(employee._id));
    assert.equal(storedTask.employeeSnapshot.employeeId, 'EMP-001');
    assert.equal(storedTask.employeeSnapshot.fullName, 'Aarav Sharma');
    assert.equal(storedTask.employeeSnapshot.email, 'aarav.sharma@example.com');
    assert.equal(storedTask.employeeSnapshot.department, 'Development');

    const detail = await apiRequest(`/tasks/${created.body.data.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.employeeSnapshot.fullName, 'Aarav Sharma');
  });

  it('repairs drifted active task counts without changing task data', async () => {
    const employeeA = await createEmployee(employeeData(1, { activeTaskCount: 7 }));
    const employeeB = await createEmployee(employeeData(2, { activeTaskCount: 3 }));

    await Task.create([
      validTask({
        taskId: 'TSK-301',
        title: 'Active task one',
        assignedEmployee: employeeA._id,
        employeeSnapshot: createEmployeeSnapshot(employeeA),
        status: 'Todo',
      }),
      validTask({
        taskId: 'TSK-302',
        title: 'Active task two',
        assignedEmployee: employeeA._id,
        employeeSnapshot: createEmployeeSnapshot(employeeA),
        status: 'In Progress',
      }),
    ]);

    const before = await Task.find({ assignedEmployee: employeeA._id })
      .sort({ taskId: 1 })
      .lean();
    const logMessages = [];
    const result = await reconcileActiveTaskCounts({
      logger: {
        info(message) {
          logMessages.push(message);
        },
        warn() {},
      },
    });

    assert.equal(result.updated, 2);
    assert.equal(result.mismatches.length, 2);
    assert.equal(result.orphanedActiveTasks.length, 0);
    assert.equal(logMessages.length, 2);

    const mismatchA = result.mismatches.find(
      (mismatch) => mismatch.employeeId === 'EMP-001',
    );
    const mismatchB = result.mismatches.find(
      (mismatch) => mismatch.employeeId === 'EMP-002',
    );

    assert.deepEqual(mismatchA, {
      employeeObjectId: String(employeeA._id),
      employeeId: 'EMP-001',
      storedCount: 7,
      actualCount: 2,
    });
    assert.deepEqual(mismatchB, {
      employeeObjectId: String(employeeB._id),
      employeeId: 'EMP-002',
      storedCount: 3,
      actualCount: 0,
    });
    assert.equal(await storedActiveCount(employeeA._id), 2);
    assert.equal(await storedActiveCount(employeeB._id), 0);

    const after = await Task.find({ assignedEmployee: employeeA._id })
      .sort({ taskId: 1 })
      .lean();
    const taskShape = (task) => ({
      taskId: task.taskId,
      title: task.title,
      status: task.status,
      startDate: task.startDate.toISOString(),
      dueDate: task.dueDate.toISOString(),
    });

    assert.deepEqual(after.map(taskShape), before.map(taskShape));
  });
});
