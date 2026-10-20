const asyncHandler = require('../middleware/asyncHandler');
const employeeService = require('../services/employee.service');

const listEmployees = asyncHandler(async (req, res) => {
  const result = await employeeService.listEmployees(req.query);
  res.status(200).json(result);
});

const createEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.createEmployee(req.body);
  res.status(201).json({ data: employee });
});

const getEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.getEmployee(req.params.id);
  res.status(200).json({ data: employee });
});

const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.updateEmployee(req.params.id, req.body);
  res.status(200).json({ data: employee });
});

const deleteEmployee = asyncHandler(async (req, res) => {
  await employeeService.deleteEmployee(req.params.id);
  res.status(204).send();
});

module.exports = {
  listEmployees,
  createEmployee,
  getEmployee,
  updateEmployee,
  deleteEmployee,
};
