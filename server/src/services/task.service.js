const mongoose = require('mongoose');
const Task = require('../models/Task');
const Employee = require('../models/Employee');
const AppError = require('../utils/AppError');
const { serializeTask } = require('../utils/serializers');
const {
  MAX_ACTIVE_TASKS_PER_EMPLOYEE,
  TASK_WRITE_FIELDS,
  TASK_STATUS_WRITE_FIELDS,
} = require('../constants/task');
const { TASK_STATUS, TASK_STATUSES } = require('../constants/domain');
const { createEmployeeSnapshot, resolveEmployeeSnapshot } = require('../utils/employeeSnapshot');
const { saveDocumentChanges } = require('../utils/documentUpdates');
const {
  ASSIGNMENT_INELIGIBILITY_REASON,
  getEmployeeAssignmentEligibility,
} = require('../utils/employeeRules');
const {
  canTransitionTaskStatus,
  isActiveTaskStatus,
  isTerminalTaskStatus,
} = require('../utils/taskRules');
const {
  parseTaskListQuery,
  buildTaskFilter,
  buildTaskSort,
  buildTaskPriorityRankExpression,
} = require('../utils/taskQuery');
const { generateTaskId } = require('./taskId.service');
const { runInTransaction } = require('./transaction.service');

function validationError(field, message) {
  return new AppError('Validation failed.', 400, [{ field, message }]);
}

function taskNotFoundError() {
  return new AppError('Task not found.', 404);
}

function employeeNotFoundError() {
  return new AppError('Employee not found.', 404);
}

function capacityConflictError() {
  return new AppError(
    `Employee already has the maximum of ${MAX_ACTIVE_TASKS_PER_EMPLOYEE} active tasks.`,
    409,
    [
      {
        field: 'assignedEmployee',
        message: `An employee can have at most ${MAX_ACTIVE_TASKS_PER_EMPLOYEE} Todo or In Progress tasks.`,
      },
    ],
  );
}

function inconsistentCapacityError() {
  return new AppError(
    'Employee active task count is inconsistent. Run the capacity reconciliation routine.',
    409,
    [
      {
        field: 'assignedEmployee',
        message: 'The stored active task count does not match the task state.',
      },
    ],
  );
}

function assertValidTaskId(taskId) {
  if (!mongoose.isObjectIdOrHexString(taskId)) {
    throw new AppError('Invalid task ID.', 400, [
      { field: 'id', message: 'Task ID must be a valid MongoDB ObjectId.' },
    ]);
  }
}

function assertValidAssignedEmployeeId(employeeId) {
  if (!mongoose.isObjectIdOrHexString(employeeId)) {
    throw validationError(
      'assignedEmployee',
      'Assigned Employee must be a valid MongoDB ObjectId.',
    );
  }
}

function assertRequestBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('body', 'Request body must be a JSON object.');
  }
}

function assertAllowedFields(body, allowedFields) {
  const unknownFields = Object.keys(body).filter(
    (field) => !allowedFields.includes(field),
  );

  if (unknownFields.length > 0) {
    throw new AppError(
      'Validation failed.',
      400,
      unknownFields.map((field) => ({
        field,
        message: `Field "${field}" is not allowed.`,
      })),
    );
  }
}

function mapAssignmentIneligibility(reason) {
  switch (reason) {
    case ASSIGNMENT_INELIGIBILITY_REASON.EMPLOYEE_NOT_FOUND:
      return employeeNotFoundError();
    case ASSIGNMENT_INELIGIBILITY_REASON.EMPLOYEE_INACTIVE:
      return new AppError('Inactive employees cannot be assigned tasks.', 400, [
        { field: 'assignedEmployee', message: 'Assigned employee must be Active.' },
      ]);
    case ASSIGNMENT_INELIGIBILITY_REASON.EMPLOYEE_ON_LEAVE:
      return new AppError('Employee is on leave for the selected Start Date.', 400, [
        {
          field: 'startDate',
          message: 'Start Date falls within the employee leave period.',
        },
      ]);
    case ASSIGNMENT_INELIGIBILITY_REASON.INVALID_LEAVE_RANGE:
      return new AppError('Employee leave dates are invalid.', 400, [
        {
          field: 'assignedEmployee',
          message: 'Assigned employee has an invalid leave date range.',
        },
      ]);
    case ASSIGNMENT_INELIGIBILITY_REASON.INVALID_START_DATE:
      return validationError(
        'startDate',
        'Start Date must be a valid date in YYYY-MM-DD format.',
      );
    case ASSIGNMENT_INELIGIBILITY_REASON.UNKNOWN_EMPLOYEE_STATUS:
      return new AppError('Employee cannot be assigned tasks.', 400, [
        { field: 'assignedEmployee', message: 'Employee status is invalid.' },
      ]);
    default:
      return new AppError('Employee cannot be assigned tasks.', 400, [
        { field: 'assignedEmployee', message: 'Employee is not eligible for assignment.' },
      ]);
  }
}

function assertAssignmentEligible(employee, startDate) {
  const eligibility = getEmployeeAssignmentEligibility(employee, startDate);

  if (!eligibility.eligible) {
    throw mapAssignmentIneligibility(eligibility.reason);
  }
}

async function loadEmployeeForAssignment(employeeId, session) {
  assertValidAssignedEmployeeId(employeeId);
  const employee = await Employee.findById(employeeId).session(session);

  if (!employee) {
    throw employeeNotFoundError();
  }

  return employee;
}

async function incrementEmployeeCapacity(employeeId, session) {
  const employee = await Employee.findOneAndUpdate(
    {
      _id: employeeId,
      activeTaskCount: { $lt: MAX_ACTIVE_TASKS_PER_EMPLOYEE },
    },
    { $inc: { activeTaskCount: 1 } },
    { new: true, session },
  );

  if (employee) {
    return;
  }

  const currentEmployee = await Employee.findById(employeeId)
    .session(session)
    .select('+activeTaskCount')
    .lean();

  if (!currentEmployee) {
    throw employeeNotFoundError();
  }

  if (currentEmployee.activeTaskCount >= MAX_ACTIVE_TASKS_PER_EMPLOYEE) {
    throw capacityConflictError();
  }

  throw inconsistentCapacityError();
}

async function decrementEmployeeCapacity(employeeId, session) {
  const employee = await Employee.findOneAndUpdate(
    {
      _id: employeeId,
      activeTaskCount: { $gt: 0 },
    },
    { $inc: { activeTaskCount: -1 } },
    { new: true, session },
  );

  if (employee) {
    return;
  }

  const currentEmployee = await Employee.findById(employeeId)
    .session(session)
    .select('+activeTaskCount')
    .lean();

  if (!currentEmployee) {
    throw new AppError('Assigned employee no longer exists.', 409, [
      {
        field: 'assignedEmployee',
        message: 'The task references an employee that no longer exists.',
      },
    ]);
  }

  throw inconsistentCapacityError();
}

function mapTaskWriteError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return new AppError(
      'Validation failed.',
      400,
      Object.values(error.errors).map((entry) => ({
        field: entry.path,
        message: entry.message,
      })),
    );
  }

  if (error instanceof mongoose.Error.CastError) {
    return new AppError('Validation failed.', 400, [
      { field: error.path, message: error.message },
    ]);
  }

  if (error?.code === 11000) {
    const duplicateFields = error.keyPattern || error.keyValue || {};
    const field = Object.keys(duplicateFields)[0] || 'taskId';
    const message =
      field === 'taskId' ? 'Task ID already exists.' : 'Task already exists.';

    return new AppError(message, 409, [{ field, message }]);
  }

  return error;
}

async function createTask(body) {
  assertRequestBody(body);
  assertAllowedFields(body, TASK_WRITE_FIELDS);
  assertValidAssignedEmployeeId(body.assignedEmployee);

  try {
    const taskId = await generateTaskId();

    const task = await runInTransaction(async (session) => {
      const employee = await loadEmployeeForAssignment(body.assignedEmployee, session);
      assertAssignmentEligible(employee, body.startDate);

      await incrementEmployeeCapacity(employee._id, session);

      const taskDocument = new Task({
        taskId,
        title: body.title,
        description: body.description,
        assignedEmployee: employee._id,
        employeeSnapshot: createEmployeeSnapshot(employee),
        department: body.department,
        priority: body.priority,
        status: TASK_STATUS.TODO,
        startDate: body.startDate,
        dueDate: body.dueDate,
        completedDate: null,
      });

      await taskDocument.save({ session });

      return taskDocument;
    });

    return serializeTask(task);
  } catch (error) {
    throw mapTaskWriteError(error);
  }
}

async function listTasks(rawQuery) {
  const query = parseTaskListQuery(rawQuery);
  const filter = buildTaskFilter(query);
  const skip = (query.page - 1) * query.limit;

  if (!Number.isSafeInteger(skip)) {
    throw validationError('page', 'page is too large.');
  }

  const now = new Date();
  let total;
  let tasks;

  if (query.sort === 'priority') {
    [total, tasks] = await Promise.all([
      Task.countDocuments(filter),
      Task.aggregate([
        { $match: filter },
        { $addFields: { __priorityRank: buildTaskPriorityRankExpression() } },
        {
          $sort: {
            __priorityRank: query.order === 'asc' ? 1 : -1,
            _id: 1,
          },
        },
        { $skip: skip },
        { $limit: query.limit },
        { $project: { __priorityRank: 0 } },
      ]),
    ]);
  } else {
    [total, tasks] = await Promise.all([
      Task.countDocuments(filter),
      Task.find(filter)
        .sort(buildTaskSort(query))
        .skip(skip)
        .limit(query.limit)
        .lean(),
    ]);
  }

  return {
    data: tasks.map((task) => serializeTask(task, now)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

async function getTask(taskId) {
  assertValidTaskId(taskId);
  const task = await Task.findById(taskId).lean();

  if (!task) {
    throw taskNotFoundError();
  }

  return serializeTask(task);
}

async function updateTask(taskId, body) {
  assertValidTaskId(taskId);
  assertRequestBody(body);
  assertAllowedFields(body, TASK_WRITE_FIELDS);

  if (Object.keys(body).length === 0) {
    throw validationError('body', 'At least one field must be provided.');
  }

  if (body.assignedEmployee !== undefined) {
    assertValidAssignedEmployeeId(body.assignedEmployee);
  }

  try {
    const task = await runInTransaction(async (session) => {
      const taskDocument = await Task.findById(taskId).session(session);

      if (!taskDocument) {
        throw taskNotFoundError();
      }

      if (isTerminalTaskStatus(taskDocument.status)) {
        throw new AppError('Completed or Cancelled tasks cannot be edited.', 409, [
          { field: 'status', message: 'Completed and Cancelled tasks are read-only.' },
        ]);
      }

      const changes = { ...body };
      const assignmentOrStartChanged =
        body.assignedEmployee !== undefined || body.startDate !== undefined;
      let targetEmployee = null;

      if (assignmentOrStartChanged) {
        const targetEmployeeId = body.assignedEmployee ?? taskDocument.assignedEmployee;
        targetEmployee = await loadEmployeeForAssignment(targetEmployeeId, session);
        assertAssignmentEligible(
          targetEmployee,
          body.startDate ?? taskDocument.startDate,
        );
      }

      if (body.assignedEmployee !== undefined) {
        const isReassignment =
          String(taskDocument.assignedEmployee) !== String(targetEmployee._id);

        if (isReassignment) {
          await decrementEmployeeCapacity(taskDocument.assignedEmployee, session);
          await incrementEmployeeCapacity(targetEmployee._id, session);
          changes.assignedEmployee = targetEmployee._id;

          const snapshot = resolveEmployeeSnapshot(
            taskDocument.assignedEmployee,
            targetEmployee,
          );

          if (snapshot) {
            changes.employeeSnapshot = snapshot;
          }
        } else {
          changes.assignedEmployee = targetEmployee._id;
        }
      }

      await saveDocumentChanges(taskDocument, changes, { session });

      return taskDocument;
    });

    return serializeTask(task);
  } catch (error) {
    throw mapTaskWriteError(error);
  }
}

async function deleteTask(taskId) {
  assertValidTaskId(taskId);

  try {
    await runInTransaction(async (session) => {
      const taskDocument = await Task.findById(taskId).session(session);

      if (!taskDocument) {
        throw taskNotFoundError();
      }

      if (isActiveTaskStatus(taskDocument.status)) {
        await decrementEmployeeCapacity(taskDocument.assignedEmployee, session);
      }

      const result = await Task.deleteOne(
        { _id: taskDocument._id },
        { session },
      );

      if (result.deletedCount !== 1) {
        throw taskNotFoundError();
      }
    });
  } catch (error) {
    throw mapTaskWriteError(error);
  }
}

async function updateTaskStatus(taskId, body) {
  assertValidTaskId(taskId);
  assertRequestBody(body);
  assertAllowedFields(body, TASK_STATUS_WRITE_FIELDS);

  if (!body.status) {
    throw validationError('status', 'Status is required.');
  }

  if (!TASK_STATUSES.includes(body.status)) {
    throw validationError(
      'status',
      `Status must be one of: ${TASK_STATUSES.join(', ')}.`,
    );
  }

  try {
    const task = await runInTransaction(async (session) => {
      const taskDocument = await Task.findById(taskId).session(session);

      if (!taskDocument) {
        throw taskNotFoundError();
      }

      if (!canTransitionTaskStatus(taskDocument.status, body.status)) {
        throw new AppError(
          `Cannot change task status from ${taskDocument.status} to ${body.status}.`,
          409,
          [
            {
              field: 'status',
              message: `Invalid status transition from ${taskDocument.status} to ${body.status}.`,
            },
          ],
        );
      }

      const changes = { status: body.status };

      if (isActiveTaskStatus(taskDocument.status) && isTerminalTaskStatus(body.status)) {
        await decrementEmployeeCapacity(taskDocument.assignedEmployee, session);
      }

      if (body.status === TASK_STATUS.COMPLETED) {
        changes.completedDate = new Date();
      }

      await saveDocumentChanges(taskDocument, changes, { session });

      return taskDocument;
    });

    return serializeTask(task);
  } catch (error) {
    throw mapTaskWriteError(error);
  }
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
};
