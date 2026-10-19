const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const Employee = require('../src/models/Employee');
const Task = require('../src/models/Task');
const Counter = require('../src/models/Counter');
const { TASK_STATUS } = require('../src/constants/domain');
const { createEmployeeSnapshot } = require('../src/utils/employeeSnapshot');
const { saveDocumentChanges } = require('../src/utils/documentUpdates');
const { generateTaskId } = require('../src/services/taskId.service');
const {
  connectTestDatabase,
  clearTestCollections,
  disconnectTestDatabase,
} = require('./helpers/testDatabase');
const { validEmployee, validTask } = require('./helpers/fixtures');

function getCollectionIndex(indexes, expectedKey) {
  return indexes.find(({ key }) => {
    const expectedFields = Object.entries(expectedKey);
    const actualFields = Object.entries(key);

    return (
      actualFields.length === expectedFields.length &&
      expectedFields.every(([field, direction]) => key[field] === direction)
    );
  });
}

describe('MongoDB model integration', () => {
  before(async () => {
    await connectTestDatabase();
  });

  after(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await clearTestCollections();
  });

  it('creates the required employee, task, and counter indexes', async () => {
    const employeeIndexes = await Employee.collection.indexes();
    assert.equal(getCollectionIndex(employeeIndexes, { employeeId: 1 })?.unique, true);
    assert.equal(getCollectionIndex(employeeIndexes, { email: 1 })?.unique, true);
    assert.ok(getCollectionIndex(employeeIndexes, { department: 1, status: 1, fullName: 1 }));
    assert.ok(getCollectionIndex(employeeIndexes, { fullName: 1 }));

    const taskIndexes = await Task.collection.indexes();
    assert.equal(getCollectionIndex(taskIndexes, { taskId: 1 })?.unique, true);
    assert.ok(getCollectionIndex(taskIndexes, { assignedEmployee: 1, status: 1 }));
    assert.ok(getCollectionIndex(taskIndexes, { status: 1, dueDate: 1 }));
    assert.ok(getCollectionIndex(taskIndexes, { department: 1, priority: 1, status: 1 }));
    assert.ok(getCollectionIndex(taskIndexes, { createdAt: -1 }));
    assert.ok(getCollectionIndex(taskIndexes, { dueDate: 1 }));
    assert.ok(getCollectionIndex(taskIndexes, { title: 1 }));
    assert.ok(getCollectionIndex(taskIndexes, { 'employeeSnapshot.fullName': 1 }));

    const counterIndexes = await Counter.collection.indexes();
    assert.equal(getCollectionIndex(counterIndexes, { name: 1 })?.unique, true);
  });

  it('normalizes and enforces unique employee emails and employee IDs', async () => {
    const employee = await Employee.create(
      validEmployee({ email: ' Test@Example.com ', employeeId: ' emp-001 ' }),
    );

    assert.equal(employee.email, 'test@example.com');
    assert.equal(employee.employeeId, 'EMP-001');

    await assert.rejects(
      Employee.create(validEmployee({ employeeId: 'EMP-002', email: 'TEST@EXAMPLE.COM' })),
      (error) => error.code === 11000,
    );

    await assert.rejects(
      Employee.create(validEmployee({ employeeId: ' emp-001 ', email: 'other@example.com' })),
      (error) => error.code === 11000,
    );
  });

  it('enforces unique task IDs', async () => {
    const taskId = await generateTaskId();
    await Task.create(
      validTask({
        taskId,
        assignedEmployee: new Types.ObjectId(),
      }),
    );

    await assert.rejects(
      Task.create(
        validTask({
          taskId,
          assignedEmployee: new Types.ObjectId(),
        }),
      ),
      (error) => error.code === 11000,
    );
  });

  it('issues unique task IDs atomically under concurrent requests', async () => {
    await Counter.deleteMany({});
    const taskIds = await Promise.all(
      Array.from({ length: 20 }, () => generateTaskId()),
    );

    assert.equal(new Set(taskIds).size, 20);
    assert.ok(taskIds.every((taskId) => /^TSK-\d{3,}$/.test(taskId)));

    const counter = await Counter.findOne({ name: 'task' }).lean();
    assert.equal(counter.seq, 20);
  });

  it('keeps the assignment snapshot after employee edits and deletion', async () => {
    const employee = await Employee.create(validEmployee());
    const taskId = await generateTaskId();
    const task = await Task.create(
      validTask({
        taskId,
        assignedEmployee: employee._id,
        employeeSnapshot: createEmployeeSnapshot(employee),
      }),
    );

    employee.fullName = 'Changed Name';
    employee.email = 'changed@example.com';
    await employee.save();

    let storedTask = await Task.findById(task._id).lean();
    assert.equal(storedTask.employeeSnapshot.fullName, 'Aarav Sharma');
    assert.equal(storedTask.employeeSnapshot.email, 'aarav.sharma@example.com');

    await Employee.deleteOne({ _id: employee._id });

    storedTask = await Task.findById(task._id).lean();
    assert.ok(storedTask);
    assert.equal(String(storedTask.assignedEmployee), String(employee._id));
    assert.equal(storedTask.employeeSnapshot.employeeId, 'EMP-001');
    assert.equal(storedTask.employeeSnapshot.fullName, 'Aarav Sharma');
    assert.equal(storedTask.employeeSnapshot.email, 'aarav.sharma@example.com');
    assert.equal(storedTask.employeeSnapshot.department, 'Development');
  });

  it('rejects invalid employee leave updates through the document-save path', async () => {
    const employee = await Employee.create(validEmployee());

    await assert.rejects(
      saveDocumentChanges(employee, { status: 'On Leave' }),
      (error) =>
        error.name === 'ValidationError' &&
        Boolean(error.errors.leaveStart) &&
        Boolean(error.errors.leaveEnd),
    );

    let storedEmployee = await Employee.findById(employee._id).lean();
    assert.equal(storedEmployee.status, 'Active');
    assert.equal(storedEmployee.leaveStart, null);
    assert.equal(storedEmployee.leaveEnd, null);

    const invalidRange = await Employee.findById(employee._id);
    await assert.rejects(
      saveDocumentChanges(invalidRange, {
        status: 'On Leave',
        leaveStart: '2024-06-14',
        leaveEnd: '2024-06-10',
      }),
      (error) => error.name === 'ValidationError' && Boolean(error.errors.leaveEnd),
    );

    storedEmployee = await Employee.findById(employee._id).lean();
    assert.equal(storedEmployee.status, 'Active');
    assert.equal(storedEmployee.leaveStart, null);
    assert.equal(storedEmployee.leaveEnd, null);

    const datesWithoutLeave = await Employee.findById(employee._id);
    await assert.rejects(
      saveDocumentChanges(datesWithoutLeave, {
        leaveStart: '2024-06-10',
        leaveEnd: '2024-06-14',
      }),
      (error) =>
        error.name === 'ValidationError' &&
        Boolean(error.errors.leaveStart) &&
        Boolean(error.errors.leaveEnd),
    );

    storedEmployee = await Employee.findById(employee._id).lean();
    assert.equal(storedEmployee.status, 'Active');
    assert.equal(storedEmployee.leaveStart, null);
    assert.equal(storedEmployee.leaveEnd, null);
  });

  it('rejects invalid task date updates through the document-save path', async () => {
    const task = await Task.create(validTask());

    const dueBeforeStart = await Task.findById(task._id);
    await assert.rejects(
      saveDocumentChanges(dueBeforeStart, { dueDate: '2024-01-31' }),
      (error) => error.name === 'ValidationError' && Boolean(error.errors.dueDate),
    );

    const startAfterDue = await Task.findById(task._id);
    await assert.rejects(
      saveDocumentChanges(startAfterDue, { startDate: '2024-02-11' }),
      (error) => error.name === 'ValidationError' && Boolean(error.errors.dueDate),
    );

    const completionWithoutStatus = await Task.findById(task._id);
    await assert.rejects(
      saveDocumentChanges(completionWithoutStatus, {
        completedDate: new Date('2024-02-09T12:00:00.000Z'),
      }),
      (error) => error.name === 'ValidationError' && Boolean(error.errors.completedDate),
    );

    const completionWithoutDate = await Task.findById(task._id);
    await assert.rejects(
      saveDocumentChanges(completionWithoutDate, { status: TASK_STATUS.COMPLETED }),
      (error) => error.name === 'ValidationError' && Boolean(error.errors.completedDate),
    );

    const storedTask = await Task.findById(task._id).lean();
    assert.equal(storedTask.status, TASK_STATUS.TODO);
    assert.equal(storedTask.completedDate, null);
    assert.equal(storedTask.startDate.toISOString(), '2024-02-01T00:00:00.000Z');
    assert.equal(storedTask.dueDate.toISOString(), '2024-02-10T00:00:00.000Z');
  });

  it('persists a valid completion through the document-save path', async () => {
    const task = await Task.create(validTask());
    const completedDate = new Date('2024-02-09T12:00:00.000Z');

    await saveDocumentChanges(task, {
      status: TASK_STATUS.COMPLETED,
      completedDate,
    });

    const storedTask = await Task.findById(task._id).lean();
    assert.equal(storedTask.status, TASK_STATUS.COMPLETED);
    assert.equal(storedTask.completedDate.toISOString(), completedDate.toISOString());
  });
});
