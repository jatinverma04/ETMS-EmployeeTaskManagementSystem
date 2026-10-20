const express = require('express');
const {
  listEmployees,
  createEmployee,
  getEmployee,
  updateEmployee,
  deleteEmployee,
} = require('../controllers/employee.controller');
const {
  createEmployeeValidators,
  updateEmployeeValidators,
} = require('../validators/employee.validators');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router
  .route('/')
  .get(listEmployees)
  .post(createEmployeeValidators, validateRequest, createEmployee);

router
  .route('/:id')
  .get(getEmployee)
  .put(updateEmployeeValidators, validateRequest, updateEmployee)
  .delete(deleteEmployee);

module.exports = router;
