const mongoose = require('mongoose');
const env = require('./env');

let isClosing = false;

mongoose.connection.on('disconnected', () => {
  if (isClosing) {
    return;
  }

  console.warn(
    'MongoDB disconnected. The health endpoint will report an error until the connection recovers.',
  );
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB connection re-established.');
});

mongoose.connection.on('error', (error) => {
  console.error(`MongoDB connection error: ${error.message}`);
});

async function connectDatabase() {
  await mongoose.connect(env.mongodbUri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    isClosing = true;
    await mongoose.connection.close();
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
};
