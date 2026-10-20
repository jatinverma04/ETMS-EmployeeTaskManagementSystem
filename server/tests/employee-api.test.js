process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/etms_phase3_test';
process.env.PORT = '5001';
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
  return response.body.errors.some((error) => error.field === field);
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

async function createTaskForEmployee(employee, overrides = {}) {
  return Task.create(
    validTask({
      taskId: overrides.taskId || 'TSK-001',
      assignedEmployee: employee._id,
      employeeSnapshot: createEmployeeSnapshot(employee),
      ...overrides,
    }),
  );
}

describe('Employee API', () => {
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

  it('creates and normalizes an employee without exposing internal fields', async () => {
    const response = await apiRequest('/employees', {
      method: 'POST',
      body: validEmployee({
        employeeId: ' emp-001 ',
        email: ' AARAV@EXAMPLE.COM ',
        skills: [' Node.js ', 'Node.js', 'MongoDB'],
        status: undefined,
      }),
    });

    assert.equal(response.status, 201);
    assert.ok(response.body.data.id);
    assert.equal(response.body.data.employeeId, 'EMP-001');
    assert.equal(response.body.data.email, 'aarav@example.com');
    assert.deepEqual(response.body.data.skills, ['Node.js', 'MongoDB']);
    assert.equal(response.body.data.joiningDate, '2024-01-15');
    assert.equal(response.body.data.status, 'Active');
    assert.equal('activeTaskCount' in response.body.data, false);
    assert.equal('__v' in response.body.data, false);
  });

  it('handles duplicate normalized employee IDs and emails with 409', async () => {
    const first = await apiRequest('/employees', {
      method: 'POST',
      body: validEmployee({
        employeeId: ' emp-001 ',
        email: ' TEST@EXAMPLE.COM ',
      }),
    });

    assert.equal(first.status, 201);

    const duplicateId = await apiRequest('/employees', {
      method: 'POST',
      body: validEmployee({
        employeeId: 'EMP-001',
        email: 'other@example.com',
      }),
    });

    assert.equal(duplicateId.status, 409);
    assert.equal(hasErrorField(duplicateId, 'employeeId'), true);

    const duplicateEmail = await apiRequest('/employees', {
      method: 'POST',
      body: validEmployee({
        employeeId: 'EMP-002',
        email: 'test@example.com',
      }),
    });

    assert.equal(duplicateEmail.status, 409);
    assert.equal(hasErrorField(duplicateEmail, 'email'), true);
    assert.equal(await Employee.countDocuments(), 1);
  });

  it('maps a unique-index race to 409 when the duplicate pre-check misses', async () => {
    await Employee.create(validEmployee());
    const originalExists = Employee.exists;

    Employee.exists = async () => null;

    try {
      const response = await apiRequest('/employees', {
        method: 'POST',
        body: validEmployee({
          email: 'other@example.com',
        }),
      });

      assert.equal(response.status, 409);
      assert.equal(hasErrorField(response, 'employeeId'), true);
    } finally {
      Employee.exists = originalExists;
    }
  });

  it('rejects missing, invalid, and unsupported create fields', async () => {
    const missing = await apiRequest('/employees', {
      method: 'POST',
      body: {},
    });

    assert.equal(missing.status, 400);
    for (const field of [
      'employeeId',
      'fullName',
      'email',
      'phone',
      'department',
      'role',
      'joiningDate',
    ]) {
      assert.equal(hasErrorField(missing, field), true, `Missing error for ${field}`);
    }

    const invalid = await apiRequest('/employees', {
      method: 'POST',
      body: validEmployee({
        email: 'not-an-email',
        phone: '123',
        department: 'Marketing',
        status: 'Unknown',
        joiningDate: '2024-02-30',
        skills: 'Node.js',
      }),
    });

    assert.equal(invalid.status, 400);
    for (const field of ['email', 'phone', 'department', 'status', 'joiningDate', 'skills']) {
      assert.equal(hasErrorField(invalid, field), true, `Missing error for ${field}`);
    }

    const internalField = await apiRequest('/employees', {
      method: 'POST',
      body: {
        ...validEmployee(),
        activeTaskCount: 5,
      },
    });

    assert.equal(internalField.status, 400);
    assert.equal(hasErrorField(internalField, 'activeTaskCount'), true);
  });

  it('enforces conditional leave dates on create', async () => {
    const noDates = await apiRequest('/employees', {
      method: 'POST',
      body: validEmployee({ status: 'On Leave', leaveStart: null, leaveEnd: null }),
    });

    assert.equal(noDates.status, 400);
    assert.equal(hasErrorField(noDates, 'leaveStart'), true);
    assert.equal(hasErrorField(noDates, 'leaveEnd'), true);

    const datesWithoutLeave = await apiRequest('/employees', {
      method: 'POST',
      body: validEmployee({
        status: 'Active',
        leaveStart: '2024-06-10',
        leaveEnd: '2024-06-14',
      }),
    });

    assert.equal(datesWithoutLeave.status, 400);
    assert.equal(hasErrorField(datesWithoutLeave, 'leaveStart'), true);
    assert.equal(hasErrorField(datesWithoutLeave, 'leaveEnd'), true);

    const invalidRange = await apiRequest('/employees', {
      method: 'POST',
      body: validEmployee({
        status: 'On Leave',
        leaveStart: '2024-06-14',
        leaveEnd: '2024-06-10',
      }),
    });

    assert.equal(invalidRange.status, 400);
    assert.equal(hasErrorField(invalidRange, 'leaveEnd'), true);
    assert.equal(await Employee.countDocuments(), 0);
  });

  it('lists employees with pagination metadata', async () => {
    await Employee.create([
      employeeData(1, { fullName: 'Alpha' }),
      employeeData(2, { fullName: 'Bravo' }),
      employeeData(3, { fullName: 'Charlie' }),
      employeeData(4, { fullName: 'Delta' }),
      employeeData(5, { fullName: 'Echo' }),
    ]);

    const pageTwo = await apiRequest('/employees?page=2&limit=2');

    assert.equal(pageTwo.status, 200);
    assert.deepEqual(
      pageTwo.body.data.map((employee) => employee.fullName),
      ['Charlie', 'Delta'],
    );
    assert.deepEqual(pageTwo.body.pagination, {
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
    assert.equal(
      pageTwo.body.data.every((employee) => !('activeTaskCount' in employee)),
      true,
    );

    const beyondLastPage = await apiRequest('/employees?page=4&limit=2');

    assert.equal(beyondLastPage.status, 200);
    assert.deepEqual(beyondLastPage.body.data, []);
    assert.equal(beyondLastPage.body.pagination.total, 5);
    assert.equal(beyondLastPage.body.pagination.totalPages, 3);
  });

  it('searches name, employee ID, and email without regex injection', async () => {
    await Employee.create([
      validEmployee({
        employeeId: 'EMP-001',
        fullName: 'Aarav Sharma',
        email: 'aarav.sharma@example.com',
      }),
      validEmployee({
        employeeId: 'EMP-002',
        fullName: 'Zara Khan',
        email: 'zara.khan@example.com',
      }),
      validEmployee({
        employeeId: 'EMP-003',
        fullName: 'Mira Patel',
        email: 'mira.patel@example.com',
      }),
    ]);

    for (const search of ['aarav', 'AARAV', 'emp-002', 'zara.khan@example']) {
      const response = await apiRequest(
        `/employees?search=${encodeURIComponent(search)}`,
      );

      assert.equal(response.status, 200);
      assert.equal(response.body.pagination.total, 1, `Search failed for ${search}`);
    }

    const regexInput = await apiRequest('/employees?search=.*');

    assert.equal(regexInput.status, 200);
    assert.equal(regexInput.body.pagination.total, 0);
  });

  it('combines department and status filters', async () => {
    await Employee.create([
      employeeData(1, { department: 'Development', status: 'Active' }),
      employeeData(2, { department: 'Design', status: 'Active' }),
      employeeData(3, { department: 'Design', status: 'Inactive' }),
      employeeData(4, {
        department: 'QA',
        status: 'On Leave',
        leaveStart: '2024-06-10',
        leaveEnd: '2024-06-14',
      }),
    ]);

    const designInactive = await apiRequest(
      '/employees?department=Design&status=Inactive',
    );

    assert.equal(designInactive.status, 200);
    assert.equal(designInactive.body.pagination.total, 1);
    assert.equal(designInactive.body.data[0].employeeId, 'EMP-003');

    const design = await apiRequest('/employees?department=Design');

    assert.equal(design.status, 200);
    assert.equal(design.body.pagination.total, 2);
    assert.equal(
      design.body.data.every((employee) => employee.department === 'Design'),
      true,
    );
  });

  it('sorts by allowlisted employee fields and directions', async () => {
    await Employee.create([
      employeeData(30, {
        employeeId: 'EMP-030',
        fullName: 'Zara Khan',
        joiningDate: '2024-03-01',
      }),
      employeeData(10, {
        employeeId: 'EMP-010',
        fullName: 'Aarav Sharma',
        joiningDate: '2024-01-15',
      }),
      employeeData(20, {
        employeeId: 'EMP-020',
        fullName: 'Mira Patel',
        joiningDate: '2024-02-01',
      }),
    ]);

    const nameDescending = await apiRequest('/employees?sort=fullName&order=desc');
    assert.deepEqual(
      nameDescending.body.data.map((employee) => employee.fullName),
      ['Zara Khan', 'Mira Patel', 'Aarav Sharma'],
    );

    const joiningAscending = await apiRequest('/employees?sort=joiningDate&order=asc');
    assert.deepEqual(
      joiningAscending.body.data.map((employee) => employee.employeeId),
      ['EMP-010', 'EMP-020', 'EMP-030'],
    );

    const employeeIdDescending = await apiRequest('/employees?sort=employeeId&order=desc');
    assert.deepEqual(
      employeeIdDescending.body.data.map((employee) => employee.employeeId),
      ['EMP-030', 'EMP-020', 'EMP-010'],
    );
  });

  it('rejects invalid and unsafe list query parameters', async () => {
    const cases = [
      ['page=0', 'page'],
      ['page=abc', 'page'],
      ['page=1&page=2', 'page'],
      ['limit=0', 'limit'],
      ['limit=101', 'limit'],
      ['limit=2.5', 'limit'],
      ['sort=createdAt', 'sort'],
      ['order=up', 'order'],
      ['department=Marketing', 'department'],
      ['status=Unknown', 'status'],
      ['unknown=value', 'unknown'],
      ['department%5B%24ne%5D=Development', 'department'],
      ['search%5B%24regex%5D=.*', 'search'],
      [`search=${'a'.repeat(101)}`, 'search'],
    ];

    for (const [queryString, field] of cases) {
      const response = await apiRequest(`/employees?${queryString}`);
      assert.equal(response.status, 400, `Expected 400 for ${queryString}`);
      assert.equal(hasErrorField(response, field), true, `Expected error for ${field}`);
    }
  });

  it('gets employee details and handles missing or invalid IDs', async () => {
    const employee = await Employee.create(validEmployee());
    const found = await apiRequest(`/employees/${employee._id}`);

    assert.equal(found.status, 200);
    assert.equal(found.body.data.employeeId, 'EMP-001');
    assert.equal('activeTaskCount' in found.body.data, false);

    const missing = await apiRequest('/employees/000000000000000000000000');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, 'Employee not found.');

    const invalid = await apiRequest('/employees/not-an-object-id');
    assert.equal(invalid.status, 400);
    assert.equal(hasErrorField(invalid, 'id'), true);
  });

  it('updates editable fields through document save and normalizes identity values', async () => {
    const employee = await Employee.create(validEmployee());

    const response = await apiRequest(`/employees/${employee._id}`, {
      method: 'PUT',
      body: {
        employeeId: ' emp-002 ',
        email: ' UPDATED@EXAMPLE.COM ',
        fullName: 'Updated Name',
        skills: [' Node.js ', 'Node.js', 'MongoDB'],
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.employeeId, 'EMP-002');
    assert.equal(response.body.data.email, 'updated@example.com');
    assert.equal(response.body.data.fullName, 'Updated Name');
    assert.deepEqual(response.body.data.skills, ['Node.js', 'MongoDB']);

    const stored = await Employee.findById(employee._id).lean();
    assert.equal(stored.employeeId, 'EMP-002');
    assert.equal(stored.email, 'updated@example.com');
    assert.equal(stored.fullName, 'Updated Name');
  });

  it('rejects duplicate identity values on update', async () => {
    const first = await Employee.create(validEmployee());
    const second = await Employee.create(
      validEmployee({
        employeeId: 'EMP-002',
        email: 'second@example.com',
      }),
    );

    const duplicateId = await apiRequest(`/employees/${second._id}`, {
      method: 'PUT',
      body: { employeeId: ' emp-001 ' },
    });

    assert.equal(duplicateId.status, 409);
    assert.equal(hasErrorField(duplicateId, 'employeeId'), true);

    const duplicateEmail = await apiRequest(`/employees/${second._id}`, {
      method: 'PUT',
      body: { email: ' AARAV.SHARMA@EXAMPLE.COM ' },
    });

    assert.equal(duplicateEmail.status, 409);
    assert.equal(hasErrorField(duplicateEmail, 'email'), true);

    const stored = await Employee.findById(second._id).lean();
    assert.equal(stored.employeeId, 'EMP-002');
    assert.equal(stored.email, 'second@example.com');
    assert.ok(first);
  });

  it('validates leave and status changes without persisting invalid combinations', async () => {
    const employee = await Employee.create(validEmployee());

    const onLeave = await apiRequest(`/employees/${employee._id}`, {
      method: 'PUT',
      body: {
        status: 'On Leave',
        leaveStart: '2024-06-10',
        leaveEnd: '2024-06-14',
      },
    });

    assert.equal(onLeave.status, 200);
    assert.equal(onLeave.body.data.leaveStart, '2024-06-10');
    assert.equal(onLeave.body.data.leaveEnd, '2024-06-14');

    const invalidRange = await apiRequest(`/employees/${employee._id}`, {
      method: 'PUT',
      body: { leaveEnd: '2024-06-09' },
    });

    assert.equal(invalidRange.status, 400);
    assert.equal(hasErrorField(invalidRange, 'leaveEnd'), true);

    let stored = await Employee.findById(employee._id).lean();
    assert.equal(stored.status, 'On Leave');
    assert.equal(stored.leaveStart.toISOString(), '2024-06-10T00:00:00.000Z');
    assert.equal(stored.leaveEnd.toISOString(), '2024-06-14T00:00:00.000Z');

    const activeWithoutClearing = await apiRequest(`/employees/${employee._id}`, {
      method: 'PUT',
      body: { status: 'Active' },
    });

    assert.equal(activeWithoutClearing.status, 400);
    assert.equal(hasErrorField(activeWithoutClearing, 'leaveStart'), true);
    assert.equal(hasErrorField(activeWithoutClearing, 'leaveEnd'), true);

    stored = await Employee.findById(employee._id).lean();
    assert.equal(stored.status, 'On Leave');

    const activeWithClearedDates = await apiRequest(`/employees/${employee._id}`, {
      method: 'PUT',
      body: { status: 'Active', leaveStart: null, leaveEnd: null },
    });

    assert.equal(activeWithClearedDates.status, 200);
    assert.equal(activeWithClearedDates.body.data.status, 'Active');
    assert.equal(activeWithClearedDates.body.data.leaveStart, null);
    assert.equal(activeWithClearedDates.body.data.leaveEnd, null);

    const datesWhileActive = await apiRequest(`/employees/${employee._id}`, {
      method: 'PUT',
      body: { leaveStart: '2024-07-01', leaveEnd: '2024-07-02' },
    });

    assert.equal(datesWhileActive.status, 400);
    assert.equal(hasErrorField(datesWhileActive, 'leaveStart'), true);
    assert.equal(hasErrorField(datesWhileActive, 'leaveEnd'), true);
  });

  it('rejects empty, unsupported, and invalid update payloads', async () => {
    const employee = await Employee.create(validEmployee());

    const empty = await apiRequest(`/employees/${employee._id}`, {
      method: 'PUT',
      body: {},
    });
    assert.equal(empty.status, 400);
    assert.equal(hasErrorField(empty, 'body'), true);

    const internalField = await apiRequest(`/employees/${employee._id}`, {
      method: 'PUT',
      body: { activeTaskCount: 2 },
    });
    assert.equal(internalField.status, 400);
    assert.equal(hasErrorField(internalField, 'activeTaskCount'), true);

    const invalidDate = await apiRequest(`/employees/${employee._id}`, {
      method: 'PUT',
      body: { joiningDate: '2024-02-30' },
    });
    assert.equal(invalidDate.status, 400);
    assert.equal(hasErrorField(invalidDate, 'joiningDate'), true);

    const missing = await apiRequest('/employees/000000000000000000000000', {
      method: 'PUT',
      body: { fullName: 'Missing Employee' },
    });
    assert.equal(missing.status, 404);

    const invalidId = await apiRequest('/employees/not-an-object-id', {
      method: 'PUT',
      body: { fullName: 'Invalid Employee' },
    });
    assert.equal(invalidId.status, 400);
  });

  it('deletes an employee without active tasks', async () => {
    const employee = await Employee.create(validEmployee());
    const response = await apiRequest(`/employees/${employee._id}`, {
      method: 'DELETE',
    });

    assert.equal(response.status, 204);
    assert.equal(response.body, null);
    assert.equal(await Employee.findById(employee._id), null);
  });

  it('blocks deletion when Todo or In Progress tasks exist', async () => {
    const employee = await Employee.create(validEmployee());
    await createTaskForEmployee(employee, { taskId: 'TSK-001', status: 'Todo' });
    await createTaskForEmployee(employee, {
      taskId: 'TSK-002',
      title: 'Second task',
      status: 'In Progress',
    });

    const response = await apiRequest(`/employees/${employee._id}`, {
      method: 'DELETE',
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.message.includes('Todo or In Progress'), true);
    assert.ok(await Employee.findById(employee._id));
    assert.equal(await Task.countDocuments({ assignedEmployee: employee._id }), 2);
  });

  it('deletes an employee with terminal tasks and preserves their snapshots', async () => {
    const employee = await Employee.create(validEmployee());
    const completedTask = await createTaskForEmployee(employee, {
      taskId: 'TSK-001',
      status: 'Completed',
      completedDate: new Date('2024-02-09T12:00:00.000Z'),
    });
    const cancelledTask = await createTaskForEmployee(employee, {
      taskId: 'TSK-002',
      title: 'Cancelled task',
      status: 'Cancelled',
    });

    const response = await apiRequest(`/employees/${employee._id}`, {
      method: 'DELETE',
    });

    assert.equal(response.status, 204);
    assert.equal(await Employee.findById(employee._id), null);

    const storedCompleted = await Task.findById(completedTask._id).lean();
    const storedCancelled = await Task.findById(cancelledTask._id).lean();

    for (const task of [storedCompleted, storedCancelled]) {
      assert.ok(task);
      assert.equal(String(task.assignedEmployee), String(employee._id));
      assert.equal(task.employeeSnapshot.employeeId, 'EMP-001');
      assert.equal(task.employeeSnapshot.fullName, 'Aarav Sharma');
      assert.equal(task.employeeSnapshot.email, 'aarav.sharma@example.com');
      assert.equal(task.employeeSnapshot.department, 'Development');
    }
  });

  it('returns 404 for missing and 400 for invalid delete IDs', async () => {
    const missing = await apiRequest('/employees/000000000000000000000000', {
      method: 'DELETE',
    });
    assert.equal(missing.status, 404);

    const invalid = await apiRequest('/employees/not-an-object-id', {
      method: 'DELETE',
    });
    assert.equal(invalid.status, 400);
    assert.equal(hasErrorField(invalid, 'id'), true);
  });
});
