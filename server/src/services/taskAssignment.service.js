const Task = require('../models/Task');
const { ACTIVE_TASK_STATUSES } = require('../constants/domain');

async function hasActiveTasksForEmployee(employeeId, { session } = {}) {
  const query = Task.exists({
    assignedEmployee: employeeId,
    status: { $in: ACTIVE_TASK_STATUSES },
  });

  if (session) {
    query.session(session);
  }

  return Boolean(await query);
}

module.exports = {
  hasActiveTasksForEmployee,
};
