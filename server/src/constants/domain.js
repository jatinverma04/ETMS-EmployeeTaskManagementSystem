const DEPARTMENTS = Object.freeze(['Development', 'Design', 'QA', 'HR', 'Sales']);

const EMPLOYEE_STATUS = Object.freeze({
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ON_LEAVE: 'On Leave',
});

const EMPLOYEE_STATUSES = Object.freeze(Object.values(EMPLOYEE_STATUS));

const TASK_PRIORITY = Object.freeze({
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
});

const TASK_PRIORITIES = Object.freeze(Object.values(TASK_PRIORITY));

const TASK_STATUS = Object.freeze({
  TODO: 'Todo',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
});

const TASK_STATUSES = Object.freeze(Object.values(TASK_STATUS));

const ACTIVE_TASK_STATUSES = Object.freeze([TASK_STATUS.TODO, TASK_STATUS.IN_PROGRESS]);
const TERMINAL_TASK_STATUSES = Object.freeze([TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED]);

const TASK_STATUS_TRANSITIONS = Object.freeze({
  [TASK_STATUS.TODO]: Object.freeze([TASK_STATUS.IN_PROGRESS, TASK_STATUS.CANCELLED]),
  [TASK_STATUS.IN_PROGRESS]: Object.freeze([TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED]),
  [TASK_STATUS.COMPLETED]: Object.freeze([]),
  [TASK_STATUS.CANCELLED]: Object.freeze([]),
});

const TASK_PRIORITY_RANK = Object.freeze({
  [TASK_PRIORITY.LOW]: 1,
  [TASK_PRIORITY.MEDIUM]: 2,
  [TASK_PRIORITY.HIGH]: 3,
  [TASK_PRIORITY.CRITICAL]: 4,
});

const TASK_ID_PATTERN = /^TSK-\d{3,}$/;
const TASK_COUNTER_NAME = 'task';

module.exports = {
  DEPARTMENTS,
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUS,
  TASK_STATUSES,
  ACTIVE_TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  TASK_STATUS_TRANSITIONS,
  TASK_PRIORITY_RANK,
  TASK_ID_PATTERN,
  TASK_COUNTER_NAME,
};
