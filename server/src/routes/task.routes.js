const express = require('express');
const {
  listTasks,
  createTask,
  getTask,
  updateTask,
  updateTaskStatus,
} = require('../controllers/task.controller');
const {
  createTaskValidators,
  updateTaskValidators,
  updateTaskStatusValidators,
} = require('../validators/task.validators');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.route('/').get(listTasks).post(createTaskValidators, validateRequest, createTask);

router
  .route('/:id/status')
  .put(updateTaskStatusValidators, validateRequest, updateTaskStatus);

router
  .route('/:id')
  .get(getTask)
  .put(updateTaskValidators, validateRequest, updateTask);

module.exports = router;
