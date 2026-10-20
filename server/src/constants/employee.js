const EMPLOYEE_WRITE_FIELDS = Object.freeze([
  'employeeId',
  'fullName',
  'email',
  'phone',
  'department',
  'role',
  'joiningDate',
  'status',
  'skills',
  'leaveStart',
  'leaveEnd',
]);

const EMPLOYEE_LIST_SORT_FIELDS = Object.freeze(['fullName', 'joiningDate', 'employeeId']);

const EMPLOYEE_LIST_QUERY_PARAMS = Object.freeze([
  'search',
  'department',
  'status',
  'sort',
  'order',
  'page',
  'limit',
]);

module.exports = {
  EMPLOYEE_WRITE_FIELDS,
  EMPLOYEE_LIST_SORT_FIELDS,
  EMPLOYEE_LIST_QUERY_PARAMS,
};
