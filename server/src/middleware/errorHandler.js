function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = error.statusCode || error.status || 500;
  let message = statusCode >= 500 ? 'Internal server error.' : error.message || 'Request failed.';

  if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON payload.';
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  const errors = Array.isArray(error.errors) ? error.errors : [];

  return res.status(statusCode).json({ message, errors });
}

module.exports = errorHandler;
