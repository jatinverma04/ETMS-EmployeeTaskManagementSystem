const Task = require('../models/Task');
const { formatDateOnly } = require('../utils/dateOnly');
const { buildCsvRow } = require('../utils/csv');
const { serializeTask } = require('../utils/serializers');
const {
  parseTaskListQuery,
  buildTaskFilter,
  buildTaskSort,
  buildTaskPriorityRankExpression,
} = require('../utils/taskQuery');

const TASK_CSV_HEADERS = Object.freeze([
  'Task ID',
  'Title',
  'Description',
  'Employee ID',
  'Employee Name',
  'Employee Email',
  'Department',
  'Priority',
  'Status',
  'Start Date',
  'Due Date',
  'Created Date',
  'Completed Date',
  'Overdue',
]);

function buildTaskExportCursor(query) {
  const filter = buildTaskFilter(query);

  if (query.sort === 'priority') {
    return Task.aggregate([
      { $match: filter },
      { $addFields: { __priorityRank: buildTaskPriorityRankExpression() } },
      {
        $sort: {
          __priorityRank: query.order === 'asc' ? 1 : -1,
          _id: 1,
        },
      },
      { $project: { __priorityRank: 0 } },
    ])
      .allowDiskUse(true)
      .cursor();
  }

  return Task.find(filter).sort(buildTaskSort(query)).lean().cursor();
}

function toCsvRow(task, now) {
  const serialized = serializeTask(task, now);
  const snapshot = serialized.employeeSnapshot || {};

  return buildCsvRow([
    serialized.taskId,
    serialized.title,
    serialized.description,
    snapshot.employeeId,
    snapshot.fullName,
    snapshot.email,
    serialized.department,
    serialized.priority,
    serialized.status,
    serialized.startDate,
    serialized.dueDate,
    formatDateOnly(serialized.createdAt),
    serialized.completedDate,
    serialized.isOverdue ? 'Yes' : 'No',
  ]);
}

async function* iterateTaskCsv(cursor, now) {
  try {
    yield `${buildCsvRow(TASK_CSV_HEADERS)}\r\n`;

    for await (const task of cursor) {
      yield `${toCsvRow(task, now)}\r\n`;
    }
  } finally {
    if (cursor && typeof cursor.close === 'function') {
      await cursor.close();
    }
  }
}

/**
 * Validates the same list query parameters as GET /api/tasks, but deliberately
 * ignores page/limit and streams every matching task through a cursor.
 */
function createTaskCsvExport(rawQuery) {
  const query = parseTaskListQuery(rawQuery);
  const now = new Date();

  return {
    filename: `tasks-${formatDateOnly(now)}.csv`,
    rows: iterateTaskCsv(buildTaskExportCursor(query), now),
  };
}

module.exports = {
  TASK_CSV_HEADERS,
  createTaskCsvExport,
};
