const { formatDateOnly } = require('./dateOnly');
const { isTaskOverdue } = require('./taskRules');

function toPlainObject(value) {
  return value && typeof value.toObject === 'function' ? value.toObject() : value;
}

function toIdString(value) {
  if (!value) {
    return null;
  }

  return value._id ? String(value._id) : String(value);
}

function serializeEmployee(employee) {
  const value = toPlainObject(employee);

  if (!value) {
    return null;
  }

  return {
    id: toIdString(value._id),
    employeeId: value.employeeId,
    fullName: value.fullName,
    email: value.email,
    phone: value.phone,
    department: value.department,
    role: value.role,
    joiningDate: formatDateOnly(value.joiningDate),
    status: value.status,
    skills: Array.isArray(value.skills) ? [...value.skills] : [],
    leaveStart: formatDateOnly(value.leaveStart),
    leaveEnd: formatDateOnly(value.leaveEnd),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function serializeTask(task, now = new Date()) {
  const value = toPlainObject(task);

  if (!value) {
    return null;
  }

  const snapshot = value.employeeSnapshot ? toPlainObject(value.employeeSnapshot) : null;

  return {
    id: toIdString(value._id),
    taskId: value.taskId,
    title: value.title,
    description: value.description,
    assignedEmployee: toIdString(value.assignedEmployee),
    employeeSnapshot: snapshot
      ? {
          employeeId: snapshot.employeeId,
          fullName: snapshot.fullName,
          email: snapshot.email,
          department: snapshot.department,
        }
      : null,
    department: value.department,
    priority: value.priority,
    status: value.status,
    startDate: formatDateOnly(value.startDate),
    dueDate: formatDateOnly(value.dueDate),
    createdAt: value.createdAt,
    completedDate: formatDateOnly(value.completedDate),
    isOverdue: isTaskOverdue({ dueDate: value.dueDate, status: value.status, now }),
  };
}

module.exports = { serializeEmployee, serializeTask };
