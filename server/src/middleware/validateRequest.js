const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

function validateRequest(req, res, next) {
  const result = validationResult(req);

  if (result.isEmpty()) {
    return next();
  }

  const errors = result.array({ onlyFirstError: true }).map(({ path, msg }) => ({
    field: path,
    message: msg,
  }));

  return next(new AppError('Validation failed.', 400, errors));
}

module.exports = validateRequest;
