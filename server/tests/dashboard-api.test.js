process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/etms_phase5_dashboard_test';
process.env.PORT = '5003';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const Employee = require('../src/models/Employee');
const Task = require('../src/models/Task');
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

async function apiRequest(path) {
  const response = await fetch(`${baseUrl}${path}`);
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

function directTask(employee, overrides = {}) {
  return validTask({
    assignedEmployee: employee._id,
    employeeSnapshot: createEmployeeSnapshot(employee),
    ...overrides,
  });
}

describe('Dashboard API', () => {
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

  it('returns employee and task breakdowns, overdue totals, and all-employee workload', async () => {
    const employeeA = await createEmployee(
      employeeData(1, { fullName: 'Aarav Sharma', activeTaskCount: 7 }),
    );
    const employeeB = await createEmployee(
      employeeData(2, { fullName: 'Bhavna Rao', department: 'Design' }),
    );
    await createEmployee(
      employeeData(3, { fullName: 'Cara Mehta', department: 'QA' }),
    );
    await createEmployee(
      employeeData(4, { fullName: 'Inactive Employee', status: 'Inactive' }),
    );
    await createEmployee(
      employeeData(5, {
        fullName: 'On Leave Employee',
        status: 'On Leave',
        leaveStart: utcDateWithOffset(-2),
        leaveEnd: utcDateWithOffset(2),
      }),
    );
    const yesterday = utcDateWithOffset(-1);
    const today = utcDateWithOffset(0);
    const tomorrow = utcDateWithOffset(1);

    await Task.create([
      directTask(employeeA, {
        taskId: 'TSK-101',
        title: 'Overdue todo',
        status: 'Todo',
        startDate: yesterday,
        dueDate: yesterday,
      }),
      directTask(employeeA, {
        taskId: 'TSK-102',
        title: 'Due today',
        status: 'In Progress',
        startDate: yesterday,
        dueDate: today,
      }),
      directTask(employeeA, {
        taskId: 'TSK-103',
        title: 'Completed late',
        status: 'Completed',
        completedDate: new Date(),
        startDate: yesterday,
        dueDate: yesterday,
      }),
      directTask(employeeB, {
        taskId: 'TSK-104',
        title: 'Cancelled late',
        status: 'Cancelled',
        startDate: yesterday,
        dueDate: yesterday,
      }),
      directTask(employeeB, {
        taskId: 'TSK-105',
        title: 'Due tomorrow',
        status: 'Todo',
        startDate: today,
        dueDate: tomorrow,
      }),
      directTask(employeeB, {
        taskId: 'TSK-106',
        title: 'Overdue in progress',
        status: 'In Progress',
        startDate: yesterday,
        dueDate: yesterday,
      }),
    ]);

    const response = await apiRequest('/dashboard');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.employees, {
      total: 5,
      active: 3,
      inactive: 1,
      onLeave: 1,
    });
    assert.deepEqual(response.body.data.tasks, {
      total: 6,
      todo: 2,
      inProgress: 2,
      completed: 1,
      cancelled: 1,
      overdue: 2,
    });

    const { workload } = response.body.data;

    assert.equal(workload.length, 5);
    assert.deepEqual(workload[0], {
      id: String(employeeA._id),
      employeeId: 'EMP-001',
      fullName: 'Aarav Sharma',
      department: 'Development',
      activeTasks: 2,
    });
    assert.equal(workload[1].employeeId, 'EMP-002');
    assert.equal(workload[1].activeTasks, 2);

    const activeTasksByEmployee = new Map(
      workload.map((entry) => [entry.employeeId, entry.activeTasks]),
    );

    assert.equal(activeTasksByEmployee.get('EMP-001'), 2);
    assert.equal(activeTasksByEmployee.get('EMP-002'), 2);
    assert.equal(activeTasksByEmployee.get('EMP-003'), 0);
    assert.equal(activeTasksByEmployee.get('EMP-004'), 0);
    assert.equal(activeTasksByEmployee.get('EMP-005'), 0);
    assert.equal('activeTaskCount' in workload[0], false);
  });

  it('returns zero values for an empty database and keeps employees with no active tasks in the workload', async () => {
    const empty = await apiRequest('/dashboard');

    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.data, {
      employees: { total: 0, active: 0, inactive: 0, onLeave: 0 },
      tasks: {
        total: 0,
        todo: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0,
        overdue: 0,
      },
      workload: [],
    });

    const employee = await createEmployee(employeeData(1));

    const response = await apiRequest('/dashboard');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.employees, {
      total: 1,
      active: 1,
      inactive: 0,
      onLeave: 0,
    });
    assert.deepEqual(response.body.data.workload, [
      {
        id: String(employee._id),
        employeeId: 'EMP-001',
        fullName: 'Employee 001',
        department: 'Development',
        activeTasks: 0,
      },
    ]);
  });

  it('uses UTC date-only overdue boundaries and never marks terminal tasks overdue', async () => {
    const employee = await createEmployee(employeeData(1));
    const yesterday = utcDateWithOffset(-1);
    const today = utcDateWithOffset(0);
    const tomorrow = utcDateWithOffset(1);

    const tasks = await Task.create([
      directTask(employee, {
        taskId: 'TSK-201',
        title: 'Overdue todo',
        status: 'Todo',
        startDate: yesterday,
        dueDate: yesterday,
      }),
      directTask(employee, {
        taskId: 'TSK-202',
        title: 'Overdue in progress',
        status: 'In Progress',
        startDate: yesterday,
        dueDate: yesterday,
      }),
      directTask(employee, {
        taskId: 'TSK-203',
        title: 'Due today',
        status: 'Todo',
        startDate: today,
        dueDate: today,
      }),
      directTask(employee, {
        taskId: 'TSK-204',
        title: 'Due tomorrow',
        status: 'Todo',
        startDate: today,
        dueDate: tomorrow,
      }),
      directTask(employee, {
        taskId: 'TSK-205',
        title: 'Completed late',
        status: 'Completed',
        completedDate: new Date(),
        startDate: yesterday,
        dueDate: yesterday,
      }),
      directTask(employee, {
        taskId: 'TSK-206',
        title: 'Cancelled late',
        status: 'Cancelled',
        startDate: yesterday,
        dueDate: yesterday,
      }),
    ]);

    const dashboard = await apiRequest('/dashboard');
    const list = await apiRequest('/tasks?limit=100&sort=title&order=asc');

    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.data.tasks.overdue, 2);
    assert.equal(list.status, 200);

    const listOverdue = Object.fromEntries(
      list.body.data.map((task) => [task.taskId, task.isOverdue]),
    );

    assert.equal(listOverdue['TSK-201'], true);
    assert.equal(listOverdue['TSK-202'], true);
    assert.equal(listOverdue['TSK-203'], false);
    assert.equal(listOverdue['TSK-204'], false);
    assert.equal(listOverdue['TSK-205'], false);
    assert.equal(listOverdue['TSK-206'], false);
    assert.equal(
      list.body.data.filter((task) => task.isOverdue).length,
      dashboard.body.data.tasks.overdue,
    );

    for (const task of tasks.filter((entry) =>
      ['TSK-205', 'TSK-206'].includes(entry.taskId),
    )) {
      const detail = await apiRequest(`/tasks/${task._id}`);

      assert.equal(detail.status, 200);
      assert.equal(detail.body.data.isOverdue, false);
    }
  });

  it('returns a safe 500 response when dashboard aggregation fails', async () => {
    const originalAggregate = Employee.aggregate;
    const originalConsoleError = console.error;

    Employee.aggregate = () => {
      throw new Error('Forced dashboard aggregation failure.');
    };
    console.error = () => {};

    try {
      const response = await apiRequest('/dashboard');

      assert.equal(response.status, 500);
      assert.equal(response.body.message, 'Internal server error.');
      assert.deepEqual(response.body.errors, []);
    } finally {
      Employee.aggregate = originalAggregate;
      console.error = originalConsoleError;
    }
  });
});
