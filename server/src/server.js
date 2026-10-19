const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/db');

const server = http.createServer(app);
let isShuttingDown = false;

async function shutdown(signal, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} received. Shutting down ETMS API...`);

  const forceExitTimer = setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  server.close(async (error) => {
    if (error) {
      console.error(`HTTP server shutdown error: ${error.message}`);
    }

    try {
      await disconnectDatabase();
      process.exit(error ? 1 : exitCode);
    } catch (disconnectError) {
      console.error(`MongoDB shutdown error: ${disconnectError.message}`);
      process.exit(1);
    }
  });
}

server.on('error', (error) => {
  console.error(`HTTP server error: ${error.message}`);
  shutdown('serverError', 1);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdown('uncaughtException', 1);
});

async function startServer() {
  try {
    await connectDatabase();
    server.listen(env.port, () => {
      console.log(`ETMS API listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error(`Failed to start ETMS API: ${error.message}`);
    process.exit(1);
  }
}

startServer();
