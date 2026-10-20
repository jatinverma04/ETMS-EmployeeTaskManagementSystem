const MAX_ACTIVE_TASKS_PER_EMPLOYEE = 3;

const TASK_WRITE_FIELDS = Object.freeze([
  'title',
  'description',
  'assignedEmployee',
  'department',
  'priority',
  'startDate',
  'dueDate',
]);

const TASK_STATUS_WRITE_FIELDS = Object.freeze(['status']);

const TASK_LIST_SORT_FIELDS = Object.freeze(['createdAt', 'dueDate', 'priority', 'title']);

const TASK_LIST_QUERY_PARAMS = Object.freeze([
  'search',
  'department',
  'priority',
  'status',
  'dueFrom',
  'dueTo',
  'sort',
  'order',
  'page',
  'limit',
]);

module.exports = {
  MAX_ACTIVE_TASKS_PER_EMPLOYEE,
  TASK_WRITE_FIELDS,
  TASK_STATUS_WRITE_FIELDS,
  TASK_LIST_SORT_FIELDS,
  TASK_LIST_QUERY_PARAMS,
};
