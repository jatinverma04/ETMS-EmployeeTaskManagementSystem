const {
  DEPARTMENTS,
  TASK_PRIORITIES,
  TASK_PRIORITY_RANK,
  TASK_STATUSES,
} = require('../constants/domain');
const {
  TASK_LIST_QUERY_PARAMS,
  TASK_LIST_SORT_FIELDS,
} = require('../constants/task');
const { compareDateOnly, isValidDate, toUtcDateOnly } = require('./dateOnly');
const AppError = require('./AppError');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;
const DEFAULT_SORT = 'createdAt';

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

function parseDateOnlyParameter(rawValue, field) {
  const value = readSingleValue(rawValue, field);

  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw invalidQuery(field, `${field} must be a valid date in YYYY-MM-DD format.`);
  }

  const date = toUtcDateOnly(value);

  if (!isValidDate(date)) {
    throw invalidQuery(field, `${field} must be a valid date in YYYY-MM-DD format.`);
  }

  return date;
}

function parseSort(rawValue) {
  const value = readSingleValue(rawValue, 'sort');

  if (value === undefined) {
    return DEFAULT_SORT;
  }

  if (typeof value !== 'string' || !TASK_LIST_SORT_FIELDS.includes(value)) {
    throw invalidQuery(
      'sort',
      `sort must be one of: ${TASK_LIST_SORT_FIELDS.join(', ')}.`,
    );
  }

  return value;
}

function defaultOrderForSort(sort) {
  // Created Date and priority default to newest/most-important first.
  // Due Date and title default to the natural ascending order.
  return sort === DEFAULT_SORT || sort === 'priority' ? 'desc' : 'asc';
}

function parseOrder(rawValue, sort) {
  const value = readSingleValue(rawValue, 'order');

  if (value === undefined) {
    return defaultOrderForSort(sort);
  }

  if (value !== 'asc' && value !== 'desc') {
    throw invalidQuery('order', 'order must be asc or desc.');
  }

  return value;
}

function parseTaskListQuery(rawQuery = {}) {
  if (!rawQuery || typeof rawQuery !== 'object' || Array.isArray(rawQuery)) {
    throw invalidQuery('query', 'Query parameters must be an object.');
  }

  const unknownParameter = Object.keys(rawQuery).find(
    (parameter) => !TASK_LIST_QUERY_PARAMS.includes(parameter),
  );

  if (unknownParameter) {
    throw invalidQuery(
      unknownParameter,
      `Unsupported query parameter: ${unknownParameter}.`,
    );
  }

  const sort = parseSort(rawQuery.sort);
  const dueFrom = parseDateOnlyParameter(rawQuery.dueFrom, 'dueFrom');
  const dueTo = parseDateOnlyParameter(rawQuery.dueTo, 'dueTo');

  if (dueFrom && dueTo && compareDateOnly(dueFrom, dueTo) > 0) {
    throw invalidQuery('dueFrom', 'dueFrom must be on or before dueTo.');
  }

  return {
    page: parseIntegerParameter(rawQuery.page, 'page', DEFAULT_PAGE, { min: 1 }),
    limit: parseIntegerParameter(rawQuery.limit, 'limit', DEFAULT_LIMIT, {
      min: 1,
      max: MAX_LIMIT,
    }),
    search: parseSearch(rawQuery.search),
    department: parseEnumParameter(rawQuery.department, 'department', DEPARTMENTS),
    priority: parseEnumParameter(rawQuery.priority, 'priority', TASK_PRIORITIES),
    status: parseEnumParameter(rawQuery.status, 'status', TASK_STATUSES),
    dueFrom,
    dueTo,
    sort,
    order: parseOrder(rawQuery.order, sort),
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTaskFilter({ search, department, priority, status, dueFrom, dueTo }) {
  const filter = {};

  if (department) {
    filter.department = department;
  }

  if (priority) {
    filter.priority = priority;
  }

  if (status) {
    filter.status = status;
  }

  if (dueFrom || dueTo) {
    filter.dueDate = {};

    if (dueFrom) {
      filter.dueDate.$gte = dueFrom;
    }

    if (dueTo) {
      filter.dueDate.$lte = dueTo;
    }
  }

  if (search) {
    const pattern = new RegExp(escapeRegExp(search), 'i');
    filter.$or = [{ title: pattern }, { 'employeeSnapshot.fullName': pattern }];
  }

  return filter;
}

function buildTaskSort({ sort, order }) {
  return {
    [sort]: order === 'desc' ? -1 : 1,
    _id: 1,
  };
}

/**
 * Priority sorting uses importance rank rather than the alphabetical string.
 * Ascending means Low -> Critical; descending means Critical -> Low.
 */
function buildTaskPriorityRankExpression() {
  return {
    $switch: {
      branches: Object.entries(TASK_PRIORITY_RANK).map(([priority, rank]) => ({
        case: { $eq: ['$priority', priority] },
        then: rank,
      })),
      default: 0,
    },
  };
}

module.exports = {
  parseTaskListQuery,
  buildTaskFilter,
  buildTaskSort,
  buildTaskPriorityRankExpression,
};
