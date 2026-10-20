const asyncHandler = require('../middleware/asyncHandler');
const taskService = require('../services/task.service');

const listTasks = asyncHandler(async (req, res) => {
  const result = await taskService.listTasks(req.query);
  res.status(200).json(result);
});

const createTask = asyncHandler(async (req, res) => {
  const task = await taskService.createTask(req.body);
  res.status(201).json({ data: task });
});

const getTask = asyncHandler(async (req, res) => {
  const task = await taskService.getTask(req.params.id);
  res.status(200).json({ data: task });
});

const updateTask = asyncHandler(async (req, res) => {
  const task = await taskService.updateTask(req.params.id, req.body);
  res.status(200).json({ data: task });
});

const updateTaskStatus = asyncHandler(async (req, res) => {
  const task = await taskService.updateTaskStatus(req.params.id, req.body);
  res.status(200).json({ data: task });
});

module.exports = {
  listTasks,
  createTask,
  getTask,
  updateTask,
  updateTaskStatus,
};
