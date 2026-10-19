const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Employee = require('../src/models/Employee');
const Task = require('../src/models/Task');
const Counter = require('../src/models/Counter');
const { serializeEmployee, serializeTask } = require('../src/utils/serializers');
const { applyDocumentChanges } = require('../src/utils/documentUpdates');
const { validEmployee, validTask } = require('./helpers/fixtures');

function assertValid(document) {
  const error = document.validateSync();
  const messages = error
    ? Object.values(error.errors)
        .map((entry) => entry.message)
        .join(' | ')
    : '';

  assert.equal(error, undefined, messages);
}

function assertInvalid(document, path) {
  const error = document.validateSync();

  assert.ok(error, `Expected a validation error for ${path}.`);
  assert.ok(error.errors[path], `Expected an error on ${path}; got ${Object.keys(error.errors).join(', ')}.`);
}

function getIndex(schema, expectedKey) {
  const entry = schema.indexes().find(([key]) => {
    const expectedFields = Object.entries(expectedKey);
    const actualFields = Object.entries(key);

    return (
      actualFields.length === expectedFields.length &&
      expectedFields.every(([field, direction]) => key[field] === direction)
    );
  });

  assert.ok(entry, `Missing index ${JSON.stringify(expectedKey)}.`);
  return entry[1];
}

describe('Employee schema', () => {
  it('accepts a valid employee and normalizes identity fields and dates', () => {
    const employee = new Employee(
      validEmployee({
        employeeId: ' emp-001 ',
        email: ' AARAV@EXAMPLE.COM ',
        joiningDate: '2024-01-15',
        skills: [' Node.js ', 'Node.js', 'MongoDB'],
      }),
    );

    assertValid(employee);
    assert.equal(employee.employeeId, 'EMP-001');
    assert.equal(employee.email, 'aarav@example.com');
    assert.equal(employee.joiningDate.toISOString(), '2024-01-15T00:00:00.000Z');
    assert.deepEqual(Array.from(employee.skills), ['Node.js', 'MongoDB']);
    assert.equal(employee.activeTaskCount, 0);
    assert.equal(employee.toJSON().activeTaskCount, undefined);
  });

  it('defaults status to Active', () => {
    const employee = new Employee(validEmployee({ status: undefined }));

    assertValid(employee);
    assert.equal(employee.status, 'Active');
  });

  it('rejects invalid email, phone, department, status, and dates', () => {
    assertInvalid(new Employee(validEmployee({ email: 'not-an-email' })), 'email');
    assertInvalid(new Employee(validEmployee({ phone: '12345' })), 'phone');
    assertInvalid(new Employee(validEmployee({ phone: '12345abcde' })), 'phone');
    assertInvalid(new Employee(validEmployee({ department: 'Marketing' })), 'department');
    assertInvalid(new Employee(validEmployee({ status: 'Unknown' })), 'status');
    assertInvalid(new Employee(validEmployee({ joiningDate: '2024-02-30' })), 'joiningDate');
  });

  it('accepts common phone punctuation with 7-15 digits', () => {
    const employee = new Employee(validEmployee({ phone: '+1 (555) 123-4567' }));

    assertValid(employee);
  });

  it('rejects invalid employee ID, full name, and role lengths', () => {
    assertInvalid(new Employee(validEmployee({ employeeId: 'A' })), 'employeeId');
    assertInvalid(new Employee(validEmployee({ fullName: 'A' })), 'fullName');
    assertInvalid(new Employee(validEmployee({ role: 'A' })), 'role');
  });

  it('normalizes skills and rejects empty, oversized, and too many skills', () => {
    const emptySkill = new Employee(validEmployee({ skills: ['Node.js', '  '] }));
    assertInvalid(emptySkill, 'skills');

    const tooManySkills = new Employee(
      validEmployee({ skills: Array.from({ length: 21 }, (_, index) => `Skill ${index}`) }),
    );
    assertInvalid(tooManySkills, 'skills');

    const tooLongSkill = new Employee(validEmployee({ skills: ['A'.repeat(51)] }));
    assertInvalid(tooLongSkill, 'skills');
  });

  it('requires leave dates only when status is On Leave', () => {
    const onLeave = new Employee(
      validEmployee({
        status: 'On Leave',
        leaveStart: '2024-06-10',
        leaveEnd: '2024-06-10',
      }),
    );
    assertValid(onLeave);
    assert.equal(onLeave.leaveStart.toISOString(), '2024-06-10T00:00:00.000Z');
    assert.equal(onLeave.leaveEnd.toISOString(), '2024-06-10T00:00:00.000Z');

    assertInvalid(
      new Employee(validEmployee({ status: 'On Leave', leaveStart: '2024-06-10', leaveEnd: null })),
      'leaveEnd',
    );
    assertInvalid(
      new Employee(validEmployee({ status: 'On Leave', leaveStart: null, leaveEnd: '2024-06-10' })),
      'leaveStart',
    );
    assertInvalid(
      new Employee(
        validEmployee({ status: 'On Leave', leaveStart: '2024-06-14', leaveEnd: '2024-06-10' }),
      ),
      'leaveEnd',
    );
  });

  it('rejects leave dates when status is not On Leave', () => {
    const employee = new Employee(
      validEmployee({
        status: 'Active',
        leaveStart: '2024-06-10',
        leaveEnd: '2024-06-14',
      }),
    );

    assertInvalid(employee, 'leaveStart');
    assert.ok(employee.validateSync().errors.leaveEnd);
  });

  it('rejects a negative active task count', () => {
    assertInvalid(new Employee(validEmployee({ activeTaskCount: -1 })), 'activeTaskCount');
  });

  it('defines the required indexes', () => {
    assert.equal(getIndex(Employee.schema, { employeeId: 1 }).unique, true);
    assert.equal(getIndex(Employee.schema, { email: 1 }).unique, true);
    getIndex(Employee.schema, { department: 1, status: 1, fullName: 1 });
    getIndex(Employee.schema, { fullName: 1 });
  });
});

describe('Task schema', () => {
  it('accepts a valid task and applies defaults', () => {
    const task = new Task(validTask());

    assertValid(task);
    assert.equal(task.taskId, 'TSK-001');
    assert.equal(task.status, 'Todo');
    assert.equal(task.completedDate, null);
    assert.equal(task.startDate.toISOString(), '2024-02-01T00:00:00.000Z');
    assert.equal(task.dueDate.toISOString(), '2024-02-10T00:00:00.000Z');
    assert.equal(Task.schema.path('taskId').options.immutable, true);
    assert.ok(Task.schema.path('createdAt'));
    assert.ok(Task.schema.path('updatedAt'));
  });

  it('rejects missing or malformed task IDs and invalid titles or descriptions', () => {
    assertInvalid(new Task(validTask({ taskId: undefined })), 'taskId');
    assertInvalid(new Task(validTask({ taskId: 'TASK-1' })), 'taskId');
    assertInvalid(new Task(validTask({ title: 'AB' })), 'title');
    assertInvalid(new Task(validTask({ description: '' })), 'description');
  });

  it('rejects invalid department, priority, status, and dates', () => {
    assertInvalid(new Task(validTask({ department: 'Marketing' })), 'department');
    assertInvalid(new Task(validTask({ priority: 'Urgent' })), 'priority');
    assertInvalid(new Task(validTask({ status: 'Blocked' })), 'status');
    assertInvalid(new Task(validTask({ startDate: '2024-02-30' })), 'startDate');
    assertInvalid(new Task(validTask({ dueDate: 'not-a-date' })), 'dueDate');
  });

  it('rejects a due date earlier than the start date', () => {
    assertInvalid(
      new Task(validTask({ startDate: '2024-02-10', dueDate: '2024-02-09' })),
      'dueDate',
    );
  });

  it('allows task department to differ from the employee snapshot department', () => {
    const task = new Task(validTask({ department: 'Sales' }));

    assertValid(task);
    assert.equal(task.employeeSnapshot.department, 'Development');
  });

  it('requires a complete employee snapshot', () => {
    assertInvalid(new Task(validTask({ employeeSnapshot: undefined })), 'employeeSnapshot');

    const missingName = new Task(
      validTask({
        employeeSnapshot: {
          employeeId: 'EMP-001',
          email: 'aarav@example.com',
          department: 'Development',
        },
      }),
    );
    assertInvalid(missingName, 'employeeSnapshot.fullName');

    const invalidEmail = new Task(
      validTask({
        employeeSnapshot: {
          employeeId: 'EMP-001',
          fullName: 'Aarav Sharma',
          email: 'invalid',
          department: 'Development',
        },
      }),
    );
    assertInvalid(invalidEmail, 'employeeSnapshot.email');
  });

  it('rejects a completed date on non-completed tasks', () => {
    const task = new Task(
      validTask({ status: 'Todo', completedDate: new Date('2024-02-11T10:30:00.000Z') }),
    );

    assertInvalid(task, 'completedDate');
  });

  it('requires a completed date for completed tasks and preserves its timestamp', () => {
    assertInvalid(new Task(validTask({ status: 'Completed' })), 'completedDate');

    const completedAt = new Date('2024-02-11T10:30:00.000Z');
    const task = new Task(validTask({ status: 'Completed', completedDate: completedAt }));

    assertValid(task);
    assert.equal(task.completedDate.toISOString(), completedAt.toISOString());
  });

  it('defines the required indexes', () => {
    assert.equal(getIndex(Task.schema, { taskId: 1 }).unique, true);
    getIndex(Task.schema, { assignedEmployee: 1, status: 1 });
    getIndex(Task.schema, { status: 1, dueDate: 1 });
    getIndex(Task.schema, { department: 1, priority: 1, status: 1 });
    getIndex(Task.schema, { createdAt: -1 });
    getIndex(Task.schema, { dueDate: 1 });
    getIndex(Task.schema, { title: 1 });
    getIndex(Task.schema, { 'employeeSnapshot.fullName': 1 });
  });
});

describe('document update helper', () => {
  it('rejects invalid employee leave changes before persistence', () => {
    const employee = applyDocumentChanges(new Employee(validEmployee()), {
      status: 'On Leave',
    });
    const error = employee.validateSync();

    assert.ok(error);
    assert.ok(error.errors.leaveStart);
    assert.ok(error.errors.leaveEnd);

    const invalidRange = applyDocumentChanges(new Employee(validEmployee()), {
      status: 'On Leave',
      leaveStart: '2024-06-14',
      leaveEnd: '2024-06-10',
    });
    assertInvalid(invalidRange, 'leaveEnd');

    const datesWithoutLeave = applyDocumentChanges(new Employee(validEmployee()), {
      leaveStart: '2024-06-10',
      leaveEnd: '2024-06-14',
    });
    const datesError = datesWithoutLeave.validateSync();

    assert.ok(datesError);
    assert.ok(datesError.errors.leaveStart);
    assert.ok(datesError.errors.leaveEnd);
  });

  it('rejects invalid task date changes before persistence', () => {
    const dueBeforeStart = applyDocumentChanges(new Task(validTask()), {
      dueDate: '2024-01-31',
    });
    assertInvalid(dueBeforeStart, 'dueDate');

    const startAfterDue = applyDocumentChanges(new Task(validTask()), {
      startDate: '2024-02-11',
    });
    assertInvalid(startAfterDue, 'dueDate');

    const completionWithoutStatus = applyDocumentChanges(new Task(validTask()), {
      completedDate: new Date('2024-02-09T12:00:00.000Z'),
    });
    assertInvalid(completionWithoutStatus, 'completedDate');

    const completionWithoutDate = applyDocumentChanges(new Task(validTask()), {
      status: 'Completed',
    });
    assertInvalid(completionWithoutDate, 'completedDate');
  });

  it('accepts a valid completion through document-save validation', async () => {
    const completedAt = new Date('2024-02-09T12:00:00.000Z');
    const task = applyDocumentChanges(new Task(validTask()), {
      status: 'Completed',
      completedDate: completedAt,
    });

    await assert.doesNotReject(task.validate());
    assert.equal(task.completedDate.toISOString(), completedAt.toISOString());
  });
});

describe('Counter schema', () => {
  it('accepts a valid counter and defaults the sequence to zero', () => {
    const counter = new Counter({ name: 'task' });

    assertValid(counter);
    assert.equal(counter.seq, 0);
  });

  it('rejects missing names and negative or fractional sequences', () => {
    assertInvalid(new Counter({ seq: 1 }), 'name');
    assertInvalid(new Counter({ name: 'task', seq: -1 }), 'seq');
    assertInvalid(new Counter({ name: 'task', seq: 1.5 }), 'seq');
  });

  it('defines a unique counter name index', () => {
    assert.equal(getIndex(Counter.schema, { name: 1 }).unique, true);
  });
});

describe('serialization helpers', () => {
  it('serializes employees with date-only fields and without the capacity counter', () => {
    const employee = new Employee(validEmployee());
    const serialized = serializeEmployee(employee);

    assert.equal(serialized.id, String(employee._id));
    assert.equal(serialized.joiningDate, '2024-01-15');
    assert.equal(serialized.leaveStart, null);
    assert.equal(serialized.leaveEnd, null);
    assert.equal('activeTaskCount' in serialized, false);
  });

  it('serializes tasks with snapshot, date-only fields, and derived overdue state', () => {
    const task = new Task(validTask());
    const serialized = serializeTask(task, new Date('2024-02-11T00:00:00.000Z'));

    assert.equal(serialized.id, String(task._id));
    assert.equal(serialized.assignedEmployee, String(task.assignedEmployee));
    assert.equal(serialized.startDate, '2024-02-01');
    assert.equal(serialized.dueDate, '2024-02-10');
    assert.equal(serialized.completedDate, null);
    assert.equal(serialized.isOverdue, true);
    assert.deepEqual(serialized.employeeSnapshot, {
      employeeId: 'EMP-001',
      fullName: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      department: 'Development',
    });
  });

  it('does not mark completed tasks overdue', () => {
    const task = new Task(
      validTask({ status: 'Completed', completedDate: new Date('2024-02-09T12:00:00.000Z') }),
    );
    const serialized = serializeTask(task, new Date('2024-02-20T00:00:00.000Z'));

    assert.equal(serialized.isOverdue, false);
    assert.equal(serialized.completedDate, '2024-02-09');
  });
});
