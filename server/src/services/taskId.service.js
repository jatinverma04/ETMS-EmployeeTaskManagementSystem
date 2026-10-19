const Counter = require('../models/Counter');
const { TASK_COUNTER_NAME } = require('../constants/domain');
const { formatTaskId } = require('../utils/taskId');

const MAX_UPSERT_RETRIES = 3;

async function generateTaskId({ session } = {}) {
  let lastError;

  for (let attempt = 0; attempt < MAX_UPSERT_RETRIES; attempt += 1) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { name: TASK_COUNTER_NAME },
        { $inc: { seq: 1 } },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          ...(session ? { session } : {}),
        },
      ).lean();

      if (!counter) {
        throw new Error('Unable to obtain the task counter.');
      }

      return formatTaskId(counter.seq);
    } catch (error) {
      const isConcurrentUpsert = error?.code === 11000 && !session;
      const canRetry = isConcurrentUpsert && attempt < MAX_UPSERT_RETRIES - 1;

      if (!canRetry) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError;
}

module.exports = { generateTaskId };
