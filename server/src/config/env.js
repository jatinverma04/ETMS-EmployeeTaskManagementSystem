const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const mongodbUri = (process.env.MONGODB_URI || '').trim();

if (!mongodbUri) {
  throw new Error(
    'MONGODB_URI is required. Copy server/.env.example to server/.env and set the values.',
  );
}

const port = Number(process.env.PORT || 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const clientOrigin = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');

module.exports = Object.freeze({
  port,
  mongodbUri,
  clientOrigin,
});
