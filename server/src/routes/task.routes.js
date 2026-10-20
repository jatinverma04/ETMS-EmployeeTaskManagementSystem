const express = require('express');
const {
  listTasks,
  exportTasksCsv,
  createTask,
  getTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
} = require('../controllers/task.controller');
const {
  createTaskValidators,
  updateTaskValidators,
  updateTaskStatusValidators,
} = require('../validators/task.validators');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.route('/').get(listTasks).post(createTaskValidators, validateRequest, createTask);

router.route('/export').get(exportTasksCsv);

router
  .route('/:id/status')
  .put(updateTaskStatusValidators, validateRequest, updateTaskStatus);

router
  .route('/:id')
  .get(getTask)
  .put(updateTaskValidators, validateRequest, updateTask)
  .delete(deleteTask);

module.exports = router;
