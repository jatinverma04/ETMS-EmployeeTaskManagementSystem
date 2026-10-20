export const DEPARTMENTS = Object.freeze(['Development', 'Design', 'QA', 'HR', 'Sales']);

export const EMPLOYEE_STATUSES = Object.freeze(['Active', 'Inactive', 'On Leave']);

export const TASK_PRIORITIES = Object.freeze(['Low', 'Medium', 'High', 'Critical']);

export const TASK_STATUSES = Object.freeze(['Todo', 'In Progress', 'Completed', 'Cancelled']);

export const TERMINAL_TASK_STATUSES = Object.freeze(['Completed', 'Cancelled']);

export const TASK_STATUS_TRANSITIONS = Object.freeze({
  Todo: Object.freeze(['In Progress', 'Cancelled']),
  'In Progress': Object.freeze(['Completed', 'Cancelled']),
  Completed: Object.freeze([]),
  Cancelled: Object.freeze([]),
});

export const EMPLOYEE_SORT_OPTIONS = Object.freeze([
  { value: 'fullName', label: 'Name' },
  { value: 'joiningDate', label: 'Joining date' },
  { value: 'employeeId', label: 'Employee ID' },
]);

export const TASK_SORT_OPTIONS = Object.freeze([
  { value: 'createdAt', label: 'Created date' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'title', label: 'Title' },
]);

export function defaultTaskOrder(sort) {
  return sort === 'createdAt' || sort === 'priority' ? 'desc' : 'asc';
}
