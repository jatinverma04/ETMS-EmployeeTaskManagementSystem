const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const AppError = require('../utils/AppError');
const { serializeEmployee } = require('../utils/serializers');
const { EMPLOYEE_WRITE_FIELDS } = require('../constants/employee');
const { normalizeEmail, normalizeEmployeeId } = require('../utils/validation');
const { saveDocumentChanges } = require('../utils/documentUpdates');
const {
  parseEmployeeListQuery,
  buildEmployeeFilter,
  buildEmployeeSort,
} = require('../utils/employeeQuery');
const { hasActiveTasksForEmployee } = require('./taskAssignment.service');
const { runInTransaction } = require('./transaction.service');

function validationError(field, message) {
  return new AppError('Validation failed.', 400, [{ field, message }]);
}

function employeeNotFoundError() {
  return new AppError('Employee not found.', 404);
}

function employeeHasActiveTasksError(
  detail = 'Employee has active tasks assigned.',
) {
  return new AppError(
    'Employee cannot be deleted while assigned Todo or In Progress tasks exist.',
    409,
    [{ field: 'id', message: detail }],
  );
}

function assertValidEmployeeId(employeeId) {
  if (!mongoose.isObjectIdOrHexString(employeeId)) {
    throw new AppError('Invalid employee ID.', 400, [
      { field: 'id', message: 'Employee ID must be a valid MongoDB ObjectId.' },
    ]);
  }
}

function assertRequestBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('body', 'Request body must be a JSON object.');
  }
}

function assertAllowedFields(body) {
  const unknownFields = Object.keys(body).filter(
    (field) => !EMPLOYEE_WRITE_FIELDS.includes(field),
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

async function assertUniqueEmployeeFields({ employeeId, email, excludeId }) {
  const checks = [];

  if (employeeId !== undefined) {
    checks.push({
      field: 'employeeId',
      label: 'Employee ID',
      value: normalizeEmployeeId(employeeId),
    });
  }

  if (email !== undefined) {
    checks.push({
      field: 'email',
      label: 'Email',
      value: normalizeEmail(email),
    });
  }

  if (checks.length === 0) {
    return;
  }

  const results = await Promise.all(
    checks.map(async (check) => {
      const query = { [check.field]: check.value };

      if (excludeId) {
        query._id = { $ne: excludeId };
      }

      return { ...check, exists: Boolean(await Employee.exists(query)) };
    }),
  );

  const duplicates = results.filter((result) => result.exists);

  if (duplicates.length === 0) {
    return;
  }

  const errors = duplicates.map((duplicate) => ({
    field: duplicate.field,
    message: `${duplicate.label} already exists.`,
  }));

  throw new AppError(
    duplicates.length === 1 ? errors[0].message : 'Employee ID and email already exist.',
    409,
    errors,
  );
}

function mapWriteError(error) {
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
    const field = Object.keys(duplicateFields)[0];

    if (!field) {
      return new AppError('Employee already exists.', 409);
    }

    const label = field === 'employeeId' ? 'Employee ID' : field === 'email' ? 'Email' : 'Field';
    const message = `${label} already exists.`;

    return new AppError(message, 409, [{ field, message }]);
  }

  return error;
}

async function createEmployee(body) {
  assertRequestBody(body);
  assertAllowedFields(body);
  await assertUniqueEmployeeFields({
    employeeId: body.employeeId,
    email: body.email,
  });

  try {
    const employee = new Employee(body);
    await employee.save();
    return serializeEmployee(employee);
  } catch (error) {
    throw mapWriteError(error);
  }
}

async function listEmployees(rawQuery) {
  const query = parseEmployeeListQuery(rawQuery);
  const filter = buildEmployeeFilter(query);
  const sort = buildEmployeeSort(query);
  const skip = (query.page - 1) * query.limit;

  if (!Number.isSafeInteger(skip)) {
    throw validationError('page', 'page is too large.');
  }

  const [total, employees] = await Promise.all([
    Employee.countDocuments(filter),
    Employee.find(filter).sort(sort).skip(skip).limit(query.limit).lean(),
  ]);

  return {
    data: employees.map(serializeEmployee),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

async function getEmployee(employeeId) {
  assertValidEmployeeId(employeeId);
  const employee = await Employee.findById(employeeId).lean();

  if (!employee) {
    throw employeeNotFoundError();
  }

  return serializeEmployee(employee);
}

async function updateEmployee(employeeId, body) {
  assertValidEmployeeId(employeeId);
  assertRequestBody(body);
  assertAllowedFields(body);

  if (Object.keys(body).length === 0) {
    throw validationError('body', 'At least one field must be provided.');
  }

  const employee = await Employee.findById(employeeId);

  if (!employee) {
    throw employeeNotFoundError();
  }

  await assertUniqueEmployeeFields({
    employeeId: body.employeeId,
    email: body.email,
    excludeId: employee._id,
  });

  try {
    await saveDocumentChanges(employee, body);
    return serializeEmployee(employee);
  } catch (error) {
    throw mapWriteError(error);
  }
}

async function deleteEmployee(employeeId) {
  assertValidEmployeeId(employeeId);

  await runInTransaction(async (session) => {
    const employee = await Employee.findById(employeeId).session(session);

    if (!employee) {
      throw employeeNotFoundError();
    }

    if (await hasActiveTasksForEmployee(employee._id, { session })) {
      throw employeeHasActiveTasksError();
    }

    // The counter guard and the transaction make the employee document the
    // serialization point for concurrent task creation.
    const deletedEmployee = await Employee.findOneAndDelete(
      { _id: employee._id, activeTaskCount: 0 },
      { session },
    );

    if (!deletedEmployee) {
      throw employeeHasActiveTasksError(
        'Employee active task count is not zero. Run capacity reconciliation before deleting.',
      );
    }
  });
}

module.exports = {
  createEmployee,
  listEmployees,
  getEmployee,
  updateEmployee,
  deleteEmployee,
};
