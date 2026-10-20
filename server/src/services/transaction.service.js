const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

const MAX_TRANSACTION_ATTEMPTS = 3;

function hasErrorLabel(error, label) {
  return typeof error?.hasErrorLabel === 'function' && error.hasErrorLabel(label);
}

function isRetryableTransactionError(error) {
  return (
    error?.code === 112 ||
    error?.codeName === 'WriteConflict' ||
    hasErrorLabel(error, 'TransientTransactionError')
  );
}

function isUnknownCommitResult(error) {
  return hasErrorLabel(error, 'UnknownTransactionCommitResult');
}

/**
 * Runs a callback in a MongoDB transaction with a bounded outer retry policy.
 *
 * The driver retries TransientTransactionError internally. The outer loop exists
 * to retry the whole callback with a fresh session if the driver still surfaces a
 * retryable conflict after its own retry budget. Unknown commit results are not
 * replayed because the first transaction may already have committed.
 */
async function runInTransaction(work) {
  if (typeof work !== 'function') {
    throw new TypeError('A transaction callback is required.');
  }

  let lastError;

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    const session = await mongoose.startSession();

    try {
      let result;

      await session.withTransaction(
        async () => {
          result = await work(session);
        },
        {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          maxCommitTimeMS: 5000,
        },
      );

      return result;
    } catch (error) {
      lastError = error;

      if (isRetryableTransactionError(error) && attempt < MAX_TRANSACTION_ATTEMPTS - 1) {
        continue;
      }

      break;
    } finally {
      await session.endSession();
    }
  }

  if (isRetryableTransactionError(lastError)) {
    throw new AppError('The request conflicted with another update. Please retry.', 409);
  }

  if (isUnknownCommitResult(lastError)) {
    throw new AppError(
      'The transaction outcome could not be confirmed. Please retry the request.',
      500,
    );
  }

  throw lastError;
}

module.exports = {
  runInTransaction,
  isRetryableTransactionError,
  isUnknownCommitResult,
};
