const { connectDatabase, disconnectDatabase } = require('../config/db');
const {
  reconcileActiveTaskCounts,
} = require('../services/capacityReconciliation.service');

async function main() {
  await connectDatabase();

  try {
    const result = await reconcileActiveTaskCounts();

    if (result.updated === 0) {
      console.log('Active task counts are already consistent.');
    } else {
      console.log(`Reconciled ${result.updated} employee active task counter(s).`);
    }

    if (result.orphanedActiveTasks.length > 0) {
      console.warn(
        'Active tasks reference employees that no longer exist. Review these records manually.',
      );
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error('Capacity reconciliation failed.', error);
  process.exitCode = 1;
});
