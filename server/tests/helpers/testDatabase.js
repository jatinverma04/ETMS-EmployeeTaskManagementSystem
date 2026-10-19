const mongoose = require('mongoose');
const Employee = require('../../src/models/Employee');
const Task = require('../../src/models/Task');
const Counter = require('../../src/models/Counter');

const TEST_DATABASE_NAME = 'etms_phase2_test';
const EXPLICIT_TEST_URI = process.env.MONGODB_TEST_URI || null;
const MEMORY_SERVER_PACKAGE = 'mongodb-memory-server';
const MEMORY_SERVER_INSTALL_COMMAND = 'npm install --save-dev mongodb-memory-server';
const CONNECT_TIMEOUT_MS = 10000;

let memoryReplicaSet = null;

function assertTestDatabase(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(uri);

  if (!match || !/test/i.test(match[1])) {
    throw new Error(
      'MONGODB_TEST_URI must point to a database whose name contains "test" to protect non-test data.',
    );
  }
}

function loadMongoMemoryServer() {
  try {
    return require(MEMORY_SERVER_PACKAGE);
  } catch (error) {
    const isMissingPackage =
      error?.code === 'MODULE_NOT_FOUND' &&
      typeof error.message === 'string' &&
      error.message.includes(`'${MEMORY_SERVER_PACKAGE}'`);

    if (!isMissingPackage) {
      throw error;
    }

    throw new Error(
      [
        'MongoDB integration tests require a replica-set test database.',
        `${MEMORY_SERVER_PACKAGE} is not installed.`,
        `From the server directory, install it manually with: ${MEMORY_SERVER_INSTALL_COMMAND}.`,
        'Alternatively, set MONGODB_TEST_URI to a dedicated replica-set or Atlas test database.',
      ].join(' '),
      { cause: error },
    );
  }
}

async function assertReplicaSet() {
  let hello;

  try {
    hello = await mongoose.connection.db.admin().command({ hello: 1 });
  } catch (error) {
    throw new Error(
      'Unable to verify that the MongoDB test database is a replica set. Transactions require a replica set.',
      { cause: error },
    );
  }

  if (!hello.setName) {
    throw new Error(
      'The MongoDB test database is a standalone server. Integration tests require a replica set (MongoMemoryReplSet or a dedicated Atlas replica-set test database).',
    );
  }
}

async function cleanupTestDatabase({ drop = false } = {}) {
  try {
    if (drop && mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
    }
  } finally {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    } finally {
      if (memoryReplicaSet) {
        const replicaSet = memoryReplicaSet;
        memoryReplicaSet = null;
        await replicaSet.stop();
      }
    }
  }
}

async function connectTestDatabase() {
  try {
    let uri = EXPLICIT_TEST_URI;

    if (uri) {
      assertTestDatabase(uri);
    } else {
      const { MongoMemoryReplSet } = loadMongoMemoryServer();

      memoryReplicaSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
      });
      uri = memoryReplicaSet.getUri(TEST_DATABASE_NAME);
      assertTestDatabase(uri);
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS });
    await assertReplicaSet();

    await mongoose.connection.dropDatabase();
    await Promise.all([Employee.init(), Task.init(), Counter.init()]);
  } catch (error) {
    await cleanupTestDatabase();
    throw error;
  }
}

async function clearTestCollections() {
  await Promise.all([Employee.deleteMany({}), Task.deleteMany({}), Counter.deleteMany({})]);
}

async function disconnectTestDatabase() {
  await cleanupTestDatabase({ drop: true });
}

module.exports = {
  TEST_DATABASE_NAME,
  connectTestDatabase,
  clearTestCollections,
  disconnectTestDatabase,
};
