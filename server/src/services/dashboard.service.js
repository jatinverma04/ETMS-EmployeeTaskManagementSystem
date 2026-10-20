const Employee = require('../models/Employee');
const Task = require('../models/Task');
const {
  ACTIVE_TASK_STATUSES,
  EMPLOYEE_STATUS,
  TASK_STATUS,
} = require('../constants/domain');
const { buildOverdueTaskFilter } = require('../utils/taskRules');

function countFor(counts, key) {
  return counts.get(key) || 0;
}

function toCountMap(rows) {
  return new Map(rows.map((row) => [row._id, row.count]));
}

function totalCount(rows) {
  return rows.reduce((total, row) => total + row.count, 0);
}

function compareWorkload(left, right) {
  if (right.activeTasks !== left.activeTasks) {
    return right.activeTasks - left.activeTasks;
  }

  const nameComparison = left.fullName.localeCompare(right.fullName);

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.employeeId.localeCompare(right.employeeId);
}

async function getDashboard() {
  const overdueFilter = buildOverdueTaskFilter(new Date());

  const [employeeStatusRows, taskStatusRows, overdue, activeTaskRows, employees] =
    await Promise.all([
      Employee.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Task.countDocuments(overdueFilter),
      Task.aggregate([
        { $match: { status: { $in: ACTIVE_TASK_STATUSES } } },
        { $group: { _id: '$assignedEmployee', activeTasks: { $sum: 1 } } },
      ]),
      Employee.find({}).select('employeeId fullName department').lean(),
    ]);

  const employeeCounts = toCountMap(employeeStatusRows);
  const taskCounts = toCountMap(taskStatusRows);
  const activeTasksByEmployee = new Map(
    activeTaskRows.map((row) => [String(row._id), row.activeTasks]),
  );

  const workload = employees
    .map((employee) => ({
      id: String(employee._id),
      employeeId: employee.employeeId,
      fullName: employee.fullName,
      department: employee.department,
      activeTasks: activeTasksByEmployee.get(String(employee._id)) || 0,
    }))
    .sort(compareWorkload);

  return {
    employees: {
      total: totalCount(employeeStatusRows),
      active: countFor(employeeCounts, EMPLOYEE_STATUS.ACTIVE),
      inactive: countFor(employeeCounts, EMPLOYEE_STATUS.INACTIVE),
      onLeave: countFor(employeeCounts, EMPLOYEE_STATUS.ON_LEAVE),
    },
    tasks: {
      total: totalCount(taskStatusRows),
      todo: countFor(taskCounts, TASK_STATUS.TODO),
      inProgress: countFor(taskCounts, TASK_STATUS.IN_PROGRESS),
      completed: countFor(taskCounts, TASK_STATUS.COMPLETED),
      cancelled: countFor(taskCounts, TASK_STATUS.CANCELLED),
      overdue,
    },
    workload,
  };
}

module.exports = {
  getDashboard,
};
