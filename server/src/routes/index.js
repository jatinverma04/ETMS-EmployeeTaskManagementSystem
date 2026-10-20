const express = require('express');
const healthRoutes = require('./health.routes');
const employeeRoutes = require('./employee.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/employees', employeeRoutes);

module.exports = router;
