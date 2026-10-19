const mongoose = require('mongoose');

const connectionStates = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

function getHealth(req, res) {
  const state = mongoose.connection.readyState;
  const database = connectionStates[state] || 'unknown';
  const healthy = state === 1;

  res.set('Cache-Control', 'no-store');

  return res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'error',
    database,
  });
}

module.exports = { getHealth };
