const Employee = require('../models/Employee');
const Task = require('../models/Task');
const { ACTIVE_TASK_STATUSES } = require('../constants/domain');

/**
 * Repairs Employee.activeTaskCount from actual active task documents.
 *
 * This is an operational recovery routine, not a concurrency mechanism. Run it
 * before serving traffic or during a maintenance window with capacity-changing
 * writes paused.
 */
async function reconcileActiveTaskCounts({ logger = console } = {}) {
  const [activeCounts, employees] = await Promise.all([
    Task.aggregate([
      { $match: { status: { $in: ACTIVE_TASK_STATUSES } } },
      { $group: { _id: '$assignedEmployee', count: { $sum: 1 } } },
    ]),
    Employee.find({}).select('+activeTaskCount').lean(),
  ]);

  const countByEmployee = new Map(
    activeCounts.map(({ _id, count }) => [String(_id), count]),
  );
  const mismatches = [];
  const updates = [];

  for (const employee of employees) {
    const employeeObjectId = String(employee._id);
    const actualCount = countByEmployee.get(employeeObjectId) || 0;
    const storedCount = Number.isInteger(employee.activeTaskCount)
      ? employee.activeTaskCount
      : 0;

    countByEmployee.delete(employeeObjectId);

    if (storedCount === actualCount) {
      continue;
    }

    const mismatch = {
      employeeObjectId,
      employeeId: employee.employeeId,
      storedCount,
      actualCount,
    };

    mismatches.push(mismatch);
    updates.push({
      updateOne: {
        filter: { _id: employee._id },
        update: { $set: { activeTaskCount: actualCount } },
      },
    });

    if (typeof logger?.info === 'function') {
      logger.info(
        `Active task count mismatch for ${employee.employeeId} (${employeeObjectId}): stored=${storedCount}, actual=${actualCount}.`,
      );
    }
  }

  if (updates.length > 0) {
    await Employee.bulkWrite(updates);
  }

  const orphanedActiveTasks = [...countByEmployee.entries()].map(
    ([employeeObjectId, count]) => ({ employeeObjectId, count }),
  );

  if (orphanedActiveTasks.length > 0 && typeof logger?.warn === 'function') {
    logger.warn(
      `Found active tasks assigned to missing employees: ${JSON.stringify(orphanedActiveTasks)}.`,
    );
  }

  return {
    mismatches,
    updated: updates.length,
    orphanedActiveTasks,
  };
}

module.exports = {
  reconcileActiveTaskCounts,
};
