process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/etms_health_test';
process.env.PORT = '5005';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const app = require('../src/app');

let server;
let baseUrl;
let originalReadyState;

function startServer() {
  return new Promise((resolve, reject) => {
    const httpServer = http.createServer(app);
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      httpServer.removeListener('error', reject);
      resolve(httpServer);
    });
  });
}

function stopServer(httpServer) {
  return new Promise((resolve, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolve()));
    httpServer.closeAllConnections();
  });
}

describe('Health API', () => {
  before(async () => {
    originalReadyState = mongoose.connection.readyState;
    server = await startServer();
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    mongoose.connection.readyState = originalReadyState;

    if (server) {
      await stopServer(server);
    }
  });

  it('returns 200 when MongoDB is connected', async () => {
    mongoose.connection.readyState = 1;

    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(body, { status: 'ok', database: 'connected' });
  });

  it('returns 503 when MongoDB is unavailable', async () => {
    mongoose.connection.readyState = 0;

    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(body, { status: 'error', database: 'disconnected' });
  });
});
