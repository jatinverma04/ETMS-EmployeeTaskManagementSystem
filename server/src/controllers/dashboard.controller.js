const asyncHandler = require('../middleware/asyncHandler');
const dashboardService = require('../services/dashboard.service');

const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await dashboardService.getDashboard();
  res.status(200).json({ data: dashboard });
});

module.exports = {
  getDashboard,
};
