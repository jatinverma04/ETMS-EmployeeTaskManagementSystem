const {
  ACTIVE_TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  TASK_STATUS_TRANSITIONS,
  TASK_PRIORITY_RANK,
} = require('../constants/domain');
const { compareDateOnly, isValidDate } = require('./dateOnly');

function canTransitionTaskStatus(fromStatus, toStatus) {
  const allowedStatuses = TASK_STATUS_TRANSITIONS[fromStatus];
  return Array.isArray(allowedStatuses) && allowedStatuses.includes(toStatus);
}

function getAllowedTaskStatusTransitions(status) {
  return [...(TASK_STATUS_TRANSITIONS[status] || [])];
}

function isActiveTaskStatus(status) {
  return ACTIVE_TASK_STATUSES.includes(status);
}

function isTerminalTaskStatus(status) {
  return TERMINAL_TASK_STATUSES.includes(status);
}

function getTaskPriorityRank(priority) {
  return TASK_PRIORITY_RANK[priority] || 0;
}

/**
 * Compares UTC calendar days. A task due today is not overdue until the next UTC day.
 */
function isTaskOverdue({ dueDate, status, now = new Date() }) {
  if (isTerminalTaskStatus(status)) {
    return false;
  }

  const currentDate = now instanceof Date ? now : new Date(now);

  if (!isValidDate(currentDate)) {
    return false;
  }

  const comparison = compareDateOnly(currentDate, dueDate);
  return comparison !== null && comparison > 0;
}

module.exports = {
  canTransitionTaskStatus,
  getAllowedTaskStatusTransitions,
  isActiveTaskStatus,
  isTerminalTaskStatus,
  getTaskPriorityRank,
  isTaskOverdue,
};
