const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const asyncHandler = require('../middleware/asyncHandler');
const taskService = require('../services/task.service');
const taskCsvService = require('../services/taskCsv.service');

const listTasks = asyncHandler(async (req, res) => {
  const result = await taskService.listTasks(req.query);
  res.status(200).json(result);
});

const exportTasksCsv = asyncHandler(async (req, res) => {
  const { filename, rows } = taskCsvService.createTaskCsvExport(req.query);

  res.status(200);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await pipeline(Readable.from(rows, { objectMode: false }), res);
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

const deleteTask = asyncHandler(async (req, res) => {
  await taskService.deleteTask(req.params.id);
  res.status(204).end();
});

module.exports = {
  listTasks,
  exportTasksCsv,
  createTask,
  getTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
};
