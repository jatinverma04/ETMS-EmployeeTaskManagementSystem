const { EMPLOYEE_STATUS } = require('../constants/domain');
const { compareDateOnly, isValidDate, toUtcDateOnly } = require('./dateOnly');

const ASSIGNMENT_INELIGIBILITY_REASON = Object.freeze({
  EMPLOYEE_NOT_FOUND: 'EMPLOYEE_NOT_FOUND',
  EMPLOYEE_INACTIVE: 'EMPLOYEE_INACTIVE',
  EMPLOYEE_ON_LEAVE: 'EMPLOYEE_ON_LEAVE',
  INVALID_LEAVE_RANGE: 'INVALID_LEAVE_RANGE',
  INVALID_START_DATE: 'INVALID_START_DATE',
  UNKNOWN_EMPLOYEE_STATUS: 'UNKNOWN_EMPLOYEE_STATUS',
});

function isDateWithinInclusiveRange(date, startDate, endDate) {
  const value = toUtcDateOnly(date);
  const start = toUtcDateOnly(startDate);
  const end = toUtcDateOnly(endDate);

  if (!isValidDate(value) || !isValidDate(start) || !isValidDate(end)) {
    return false;
  }

  return value.getTime() >= start.getTime() && value.getTime() <= end.getTime();
}

/**
 * Active employees still require the separate task-capacity check enforced by later task services.
 */
function getEmployeeAssignmentEligibility(employee, taskStartDate) {
  if (!employee) {
    return { eligible: false, reason: ASSIGNMENT_INELIGIBILITY_REASON.EMPLOYEE_NOT_FOUND };
  }

  if (employee.status === EMPLOYEE_STATUS.INACTIVE) {
    return { eligible: false, reason: ASSIGNMENT_INELIGIBILITY_REASON.EMPLOYEE_INACTIVE };
  }

  if (employee.status === EMPLOYEE_STATUS.ON_LEAVE) {
    const leaveStart = toUtcDateOnly(employee.leaveStart);
    const leaveEnd = toUtcDateOnly(employee.leaveEnd);
    const startDate = toUtcDateOnly(taskStartDate);

    if (!isValidDate(startDate)) {
      return { eligible: false, reason: ASSIGNMENT_INELIGIBILITY_REASON.INVALID_START_DATE };
    }

    if (
      !isValidDate(leaveStart) ||
      !isValidDate(leaveEnd) ||
      compareDateOnly(leaveStart, leaveEnd) > 0
    ) {
      return { eligible: false, reason: ASSIGNMENT_INELIGIBILITY_REASON.INVALID_LEAVE_RANGE };
    }

    if (isDateWithinInclusiveRange(startDate, leaveStart, leaveEnd)) {
      return { eligible: false, reason: ASSIGNMENT_INELIGIBILITY_REASON.EMPLOYEE_ON_LEAVE };
    }

    return { eligible: true, reason: null };
  }

  if (employee.status === EMPLOYEE_STATUS.ACTIVE) {
    return { eligible: true, reason: null };
  }

  return { eligible: false, reason: ASSIGNMENT_INELIGIBILITY_REASON.UNKNOWN_EMPLOYEE_STATUS };
}

module.exports = {
  ASSIGNMENT_INELIGIBILITY_REASON,
  isDateWithinInclusiveRange,
  getEmployeeAssignmentEligibility,
};
