const { normalizeEmail, normalizeEmployeeId } = require('./validation');

function createEmployeeSnapshot(employee) {
  if (!employee) {
    throw new TypeError('An employee is required to create an assignment snapshot.');
  }

  return {
    employeeId: normalizeEmployeeId(employee.employeeId ?? ''),
    fullName: String(employee.fullName ?? '').trim(),
    email: normalizeEmail(employee.email ?? ''),
    department: employee.department,
  };
}

function shouldRefreshEmployeeSnapshot(currentAssignedEmployeeId, nextAssignedEmployeeId) {
  if (!nextAssignedEmployeeId) {
    throw new TypeError('The next assigned employee ID is required.');
  }

  if (!currentAssignedEmployeeId) {
    return true;
  }

  return String(currentAssignedEmployeeId) !== String(nextAssignedEmployeeId);
}

/**
 * Returns null when the employee is unchanged, preserving the existing immutable snapshot.
 */
function resolveEmployeeSnapshot(currentAssignedEmployeeId, employee) {
  if (!shouldRefreshEmployeeSnapshot(currentAssignedEmployeeId, employee?._id)) {
    return null;
  }

  return createEmployeeSnapshot(employee);
}

module.exports = {
  createEmployeeSnapshot,
  shouldRefreshEmployeeSnapshot,
  resolveEmployeeSnapshot,
};
