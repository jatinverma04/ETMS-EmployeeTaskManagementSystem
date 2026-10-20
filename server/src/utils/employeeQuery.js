const { DEPARTMENTS, EMPLOYEE_STATUSES } = require('../constants/domain');
const {
  EMPLOYEE_LIST_QUERY_PARAMS,
  EMPLOYEE_LIST_SORT_FIELDS,
} = require('../constants/employee');
const AppError = require('./AppError');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;

function invalidQuery(field, message) {
  return new AppError('Invalid query parameters.', 400, [{ field, message }]);
}

function readSingleValue(rawValue, field) {
  if (Array.isArray(rawValue) || (rawValue !== null && typeof rawValue === 'object')) {
    throw invalidQuery(field, `${field} must be a single value.`);
  }

  return rawValue;
}

function parseIntegerParameter(rawValue, field, defaultValue, { min, max }) {
  const value = readSingleValue(rawValue, field);

  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw invalidQuery(field, `${field} must be a positive integer.`);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < min || (max !== undefined && parsed > max)) {
    const range = max === undefined ? `at least ${min}` : `between ${min} and ${max}`;
    throw invalidQuery(field, `${field} must be ${range}.`);
  }

  return parsed;
}

function parseSearch(rawValue) {
  const value = readSingleValue(rawValue, 'search');

  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw invalidQuery('search', 'search must be a string.');
  }

  const trimmed = value.trim();

  if (trimmed.length > MAX_SEARCH_LENGTH) {
    throw invalidQuery('search', `search must be at most ${MAX_SEARCH_LENGTH} characters.`);
  }

  return trimmed || null;
}

function parseEnumParameter(rawValue, field, allowedValues) {
  const value = readSingleValue(rawValue, field);

  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    throw invalidQuery(field, `${field} must be one of: ${allowedValues.join(', ')}.`);
  }

  return value;
}

function parseSort(rawValue) {
  const value = readSingleValue(rawValue, 'sort');

  if (value === undefined) {
    return 'fullName';
  }

  if (typeof value !== 'string' || !EMPLOYEE_LIST_SORT_FIELDS.includes(value)) {
    throw invalidQuery(
      'sort',
      `sort must be one of: ${EMPLOYEE_LIST_SORT_FIELDS.join(', ')}.`,
    );
  }

  return value;
}

function parseOrder(rawValue) {
  const value = readSingleValue(rawValue, 'order');

  if (value === undefined) {
    return 'asc';
  }

  if (value !== 'asc' && value !== 'desc') {
    throw invalidQuery('order', 'order must be asc or desc.');
  }

  return value;
}

function parseEmployeeListQuery(rawQuery = {}) {
  if (!rawQuery || typeof rawQuery !== 'object' || Array.isArray(rawQuery)) {
    throw invalidQuery('query', 'Query parameters must be an object.');
  }

  const unknownParameter = Object.keys(rawQuery).find(
    (parameter) => !EMPLOYEE_LIST_QUERY_PARAMS.includes(parameter),
  );

  if (unknownParameter) {
    throw invalidQuery(
      unknownParameter,
      `Unsupported query parameter: ${unknownParameter}.`,
    );
  }

  return {
    page: parseIntegerParameter(rawQuery.page, 'page', DEFAULT_PAGE, { min: 1 }),
    limit: parseIntegerParameter(rawQuery.limit, 'limit', DEFAULT_LIMIT, {
      min: 1,
      max: MAX_LIMIT,
    }),
    search: parseSearch(rawQuery.search),
    department: parseEnumParameter(rawQuery.department, 'department', DEPARTMENTS),
    status: parseEnumParameter(rawQuery.status, 'status', EMPLOYEE_STATUSES),
    sort: parseSort(rawQuery.sort),
    order: parseOrder(rawQuery.order),
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildEmployeeFilter({ search, department, status }) {
  const filter = {};

  if (department) {
    filter.department = department;
  }

  if (status) {
    filter.status = status;
  }

  if (search) {
    const pattern = new RegExp(escapeRegExp(search), 'i');
    filter.$or = [{ fullName: pattern }, { employeeId: pattern }, { email: pattern }];
  }

  return filter;
}

function buildEmployeeSort({ sort, order }) {
  return {
    [sort]: order === 'desc' ? -1 : 1,
    _id: 1,
  };
}

module.exports = {
  parseEmployeeListQuery,
  buildEmployeeFilter,
  buildEmployeeSort,
};
