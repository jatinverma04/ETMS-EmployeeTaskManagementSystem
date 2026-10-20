process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/etms_phase5_csv_test';
process.env.PORT = '5004';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const Employee = require('../src/models/Employee');
const Task = require('../src/models/Task');
const { createEmployeeSnapshot } = require('../src/utils/employeeSnapshot');
const { buildCsvRow } = require('../src/utils/csv');
const { TASK_CSV_HEADERS } = require('../src/services/taskCsv.service');
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

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  return {
    status: response.status,
    text,
    contentType,
    contentDisposition: response.headers.get('content-disposition'),
    body: contentType.includes('application/json') && text ? JSON.parse(text) : null,
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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }

      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && text[index + 1] === '\n') {
        index += 1;
      }

      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
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

async function createDirectTask(employee, overrides = {}) {
  return Task.create(
    validTask({
      assignedEmployee: employee._id,
      employeeSnapshot: createEmployeeSnapshot(employee),
      ...overrides,
    }),
  );
}

function rowsByTaskId(rows) {
  return new Map(rows.slice(1).map((row) => [row[0], row]));
}

describe('Task CSV export', () => {
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

  it('exports the documented header and every matching task with snapshot fields despite pagination', async () => {
    const employee = await createEmployee(
      employeeData(1, { fullName: 'Aarav Sharma' }),
    );

    const alpha = await createDirectTask(employee, {
      taskId: 'TSK-001',
      title: 'Alpha Task',
      description: 'First description',
      department: 'Development',
      priority: 'High',
      status: 'Todo',
      startDate: '2024-06-01',
      dueDate: '2024-06-10',
    });
    await createDirectTask(employee, {
      taskId: 'TSK-002',
      title: 'Beta Task',
      description: 'Second description',
      department: 'Design',
      priority: 'Medium',
      status: 'Completed',
      completedDate: new Date('2024-06-12T12:00:00.000Z'),
      startDate: '2024-06-02',
      dueDate: '2024-06-12',
    });

    const response = await request('/tasks/export?page=2&limit=1');

    assert.equal(response.status, 200);
    assert.equal(response.contentType, 'text/csv; charset=utf-8');
    assert.match(
      response.contentDisposition,
      /^attachment; filename="tasks-\d{4}-\d{2}-\d{2}\.csv"$/,
    );

    const rows = parseCsv(response.text);

    assert.deepEqual(rows[0], [...TASK_CSV_HEADERS]);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].includes('_id'), false);
    assert.equal(rows[0].includes('activeTaskCount'), false);
    assert.equal(rows[0].includes('__v'), false);

    const byId = rowsByTaskId(rows);
    const alphaRow = byId.get('TSK-001');
    const betaRow = byId.get('TSK-002');

    assert.ok(alphaRow);
    assert.ok(betaRow);
    assert.equal(alphaRow[1], 'Alpha Task');
    assert.equal(alphaRow[2], 'First description');
    assert.equal(alphaRow[3], 'EMP-001');
    assert.equal(alphaRow[4], 'Aarav Sharma');
    assert.equal(alphaRow[5], 'employee001@example.com');
    assert.equal(alphaRow[6], 'Development');
    assert.equal(alphaRow[7], 'High');
    assert.equal(alphaRow[8], 'Todo');
    assert.equal(alphaRow[9], '2024-06-01');
    assert.equal(alphaRow[10], '2024-06-10');
    assert.equal(
      alphaRow[11],
      alpha.createdAt.toISOString().slice(0, 10),
    );
    assert.equal(alphaRow[12], '');
    assert.equal(alphaRow[13], 'Yes');

    assert.equal(betaRow[8], 'Completed');
    assert.equal(betaRow[12], '2024-06-12');
    assert.equal(betaRow[13], 'No');
  });

  it('applies the same combined filters, search, and sorting as the task list without pagination', async () => {
    const employeeA = await createEmployee(
      employeeData(1, { fullName: 'Aarav Sharma' }),
    );
    const employeeB = await createEmployee(
      employeeData(2, { fullName: 'Zara Khan', department: 'Design' }),
    );

    await Task.create([
      validTask({
        taskId: 'TSK-201',
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
        taskId: 'TSK-202',
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
        taskId: 'TSK-203',
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
        taskId: 'TSK-204',
        title: 'Delta',
        assignedEmployee: employeeB._id,
        employeeSnapshot: createEmployeeSnapshot(employeeB),
        department: 'Design',
        priority: 'High',
        status: 'Todo',
        startDate: '2024-06-01',
        dueDate: '2024-06-13',
      }),
      validTask({
        taskId: 'TSK-205',
        title: 'Echo',
        assignedEmployee: employeeB._id,
        employeeSnapshot: createEmployeeSnapshot(employeeB),
        department: 'Design',
        priority: 'High',
        status: 'Todo',
        startDate: '2024-06-01',
        dueDate: '2024-06-14',
      }),
    ]);

    const combinedPath =
      '/tasks/export?search=zara&department=Design&priority=High&status=Todo' +
      '&dueFrom=2024-06-13&dueTo=2024-06-14&sort=title&order=asc&page=2&limit=1';
    const combined = await request(combinedPath);

    assert.equal(combined.status, 200);

    const combinedRows = parseCsv(combined.text);

    assert.deepEqual(
      combinedRows.slice(1).map((row) => row[0]),
      ['TSK-204', 'TSK-205'],
    );

    const priorityExport = await request('/tasks/export?sort=priority&limit=1');
    const priorityList = await request('/tasks?sort=priority&limit=100');

    assert.equal(priorityExport.status, 200);
    assert.equal(priorityList.status, 200);
    assert.deepEqual(
      parseCsv(priorityExport.text)
        .slice(1)
        .map((row) => row[0]),
      priorityList.body.data.map((task) => task.taskId),
    );

    const priorityAscExport = await request(
      '/tasks/export?sort=priority&order=asc',
    );
    const priorityAscList = await request(
      '/tasks?sort=priority&order=asc&limit=100',
    );

    assert.deepEqual(
      parseCsv(priorityAscExport.text)
        .slice(1)
        .map((row) => row[0]),
      priorityAscList.body.data.map((task) => task.taskId),
    );
  });

  it('escapes commas, quotes, and newlines and prevents spreadsheet formula injection', async () => {
    const employee = await createEmployee(
      employeeData(10, {
        fullName: '@Formula Employee',
        email: 'formula.employee@example.com',
      }),
    );

    await createDirectTask(employee, {
      taskId: 'TSK-301',
      title: 'Comma, Quote "Value"',
      description: 'Line one\nLine two',
      status: 'Todo',
      startDate: utcDateWithOffset(0),
      dueDate: utcDateWithOffset(5),
    });
    await createDirectTask(employee, {
      taskId: 'TSK-302',
      title: '=HYPERLINK("http://evil.example")',
      description: '+SUM(1,1)',
      status: 'Todo',
      startDate: utcDateWithOffset(0),
      dueDate: utcDateWithOffset(5),
    });
    await createDirectTask(employee, {
      taskId: 'TSK-303',
      title: '-1+2',
      description: '@cmd',
      status: 'Todo',
      startDate: utcDateWithOffset(0),
      dueDate: utcDateWithOffset(5),
    });

    const response = await request('/tasks/export?sort=title&order=asc');

    assert.equal(response.status, 200);
    assert.ok(
      response.text.includes('"Comma, Quote ""Value"""'),
      'Expected embedded quotes and commas to be escaped.',
    );
    assert.ok(
      response.text.includes('"Line one\nLine two"'),
      'Expected embedded newlines to be quoted.',
    );

    const byId = rowsByTaskId(parseCsv(response.text));
    const commaRow = byId.get('TSK-301');
    const formulaRow = byId.get('TSK-302');
    const minusRow = byId.get('TSK-303');

    assert.equal(commaRow[1], 'Comma, Quote "Value"');
    assert.equal(commaRow[2], 'Line one\nLine two');
    assert.equal(commaRow[4], "'@Formula Employee");

    assert.equal(formulaRow[1], '\'=HYPERLINK("http://evil.example")');
    assert.equal(formulaRow[2], "'+SUM(1,1)");
    assert.equal(formulaRow[4], "'@Formula Employee");

    assert.equal(minusRow[1], "'-1+2");
    assert.equal(minusRow[2], "'@cmd");
    assert.equal(minusRow[4], "'@Formula Employee");
  });

  it('returns only the header for empty matches and rejects invalid export queries before streaming', async () => {
    const expectedHeader = `${buildCsvRow(TASK_CSV_HEADERS)}\r\n`;
    const empty = await request('/tasks/export');

    assert.equal(empty.status, 200);
    assert.equal(empty.contentType, 'text/csv; charset=utf-8');
    assert.equal(empty.text, expectedHeader);

    const employee = await createEmployee(employeeData(1));

    await createDirectTask(employee, {
      taskId: 'TSK-401',
      title: 'Only task',
      status: 'Todo',
      startDate: utcDateWithOffset(0),
      dueDate: utcDateWithOffset(5),
    });

    const noMatch = await request('/tasks/export?search=does-not-exist');

    assert.equal(noMatch.status, 200);
    assert.equal(noMatch.text, expectedHeader);

    const invalidPaths = [
      '/tasks/export?page=0',
      '/tasks/export?limit=101',
      '/tasks/export?sort=description',
      '/tasks/export?dueFrom=2024-06-10&dueTo=2024-06-09',
      '/tasks/export?export=csv',
      '/tasks/export?search=one&search=two',
    ];

    for (const path of invalidPaths) {
      const invalid = await request(path);

      assert.equal(invalid.status, 400, `Expected 400 for ${path}`);
      assert.equal(invalid.contentType.startsWith('application/json'), true);
      assert.equal(invalid.contentDisposition, null);
      assert.equal(invalid.body.message, 'Invalid query parameters.');
      assert.ok(invalid.body.errors.length > 0);
    }
  });

  it('returns a JSON 500 when the export query fails before headers are sent', async () => {
    const originalFind = Task.find;
    const originalConsoleError = console.error;

    Task.find = () => {
      throw new Error('Forced CSV read failure.');
    };
    console.error = () => {};

    try {
      const response = await request('/tasks/export');

      assert.equal(response.status, 500);
      assert.equal(response.contentType.startsWith('application/json'), true);
      assert.equal(response.body.message, 'Internal server error.');
    } finally {
      Task.find = originalFind;
      console.error = originalConsoleError;
    }
  });

  it('keeps CSV overdue values consistent with the task list and dashboard', async () => {
    const employee = await createEmployee(employeeData(1));
    const yesterday = utcDateWithOffset(-1);
    const today = utcDateWithOffset(0);
    const tomorrow = utcDateWithOffset(1);

    await Task.create([
      validTask({
        taskId: 'TSK-501',
        title: 'Overdue todo',
        assignedEmployee: employee._id,
        employeeSnapshot: createEmployeeSnapshot(employee),
        status: 'Todo',
        startDate: yesterday,
        dueDate: yesterday,
      }),
      validTask({
        taskId: 'TSK-502',
        title: 'Overdue in progress',
        assignedEmployee: employee._id,
        employeeSnapshot: createEmployeeSnapshot(employee),
        status: 'In Progress',
        startDate: yesterday,
        dueDate: yesterday,
      }),
      validTask({
        taskId: 'TSK-503',
        title: 'Due today',
        assignedEmployee: employee._id,
        employeeSnapshot: createEmployeeSnapshot(employee),
        status: 'Todo',
        startDate: today,
        dueDate: today,
      }),
      validTask({
        taskId: 'TSK-504',
        title: 'Due tomorrow',
        assignedEmployee: employee._id,
        employeeSnapshot: createEmployeeSnapshot(employee),
        status: 'Todo',
        startDate: today,
        dueDate: tomorrow,
      }),
      validTask({
        taskId: 'TSK-505',
        title: 'Completed late',
        assignedEmployee: employee._id,
        employeeSnapshot: createEmployeeSnapshot(employee),
        status: 'Completed',
        completedDate: new Date(),
        startDate: yesterday,
        dueDate: yesterday,
      }),
      validTask({
        taskId: 'TSK-506',
        title: 'Cancelled late',
        assignedEmployee: employee._id,
        employeeSnapshot: createEmployeeSnapshot(employee),
        status: 'Cancelled',
        startDate: yesterday,
        dueDate: yesterday,
      }),
    ]);

    const list = await request('/tasks?limit=100&sort=title&order=asc');
    const dashboard = await request('/dashboard');
    const exported = await request('/tasks/export?sort=title&order=asc');

    assert.equal(list.status, 200);
    assert.equal(dashboard.status, 200);
    assert.equal(exported.status, 200);

    const listOverdue = Object.fromEntries(
      list.body.data.map((task) => [task.taskId, task.isOverdue]),
    );
    const csvOverdue = Object.fromEntries(
      parseCsv(exported.text)
        .slice(1)
        .map((row) => [row[0], row[13]]),
    );

    assert.equal(dashboard.body.data.tasks.overdue, 2);
    assert.equal(
      Object.values(listOverdue).filter(Boolean).length,
      dashboard.body.data.tasks.overdue,
    );
    assert.equal(
      Object.values(csvOverdue).filter((value) => value === 'Yes').length,
      dashboard.body.data.tasks.overdue,
    );
    assert.equal(listOverdue['TSK-501'], true);
    assert.equal(listOverdue['TSK-502'], true);
    assert.equal(listOverdue['TSK-505'], false);
    assert.equal(listOverdue['TSK-506'], false);
    assert.equal(csvOverdue['TSK-501'], 'Yes');
    assert.equal(csvOverdue['TSK-502'], 'Yes');
    assert.equal(csvOverdue['TSK-505'], 'No');
    assert.equal(csvOverdue['TSK-506'], 'No');
  });
});
