const {
  ACTIVE_TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  TASK_STATUS_TRANSITIONS,
  TASK_PRIORITY_RANK,
} = require('../constants/domain');
const { isValidDate, toUtcDateOnly } = require('./dateOnly');

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

function getOverdueCutoff(now = new Date()) {
  const currentDate = now instanceof Date ? now : new Date(now);

  if (!isValidDate(currentDate)) {
    return null;
  }

  return toUtcDateOnly(currentDate);
}

/**
 * Database filter for active tasks whose Due Date is before today's UTC
 * date-only boundary. Dashboard aggregation and isTaskOverdue share this rule.
 */
function buildOverdueTaskFilter(now = new Date()) {
  const cutoff = getOverdueCutoff(now);

  if (!cutoff) {
    return null;
  }

  return {
    status: { $in: ACTIVE_TASK_STATUSES },
    dueDate: { $lt: cutoff },
  };
}

/**
 * Compares UTC calendar days. A task due today is not overdue until the next UTC day.
 */
function isTaskOverdue({ dueDate, status, now = new Date() }) {
  if (isTerminalTaskStatus(status)) {
    return false;
  }

  const cutoff = getOverdueCutoff(now);
  const normalizedDueDate = toUtcDateOnly(dueDate);

  if (!cutoff || !isValidDate(normalizedDueDate)) {
    return false;
  }

  return normalizedDueDate.getTime() < cutoff.getTime();
}

module.exports = {
  canTransitionTaskStatus,
  getAllowedTaskStatusTransitions,
  isActiveTaskStatus,
  isTerminalTaskStatus,
  getTaskPriorityRank,
  buildOverdueTaskFilter,
  isTaskOverdue,
};
