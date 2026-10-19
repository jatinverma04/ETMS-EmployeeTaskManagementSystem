function formatTaskId(sequence) {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new TypeError('Task sequence must be a positive integer.');
  }

  return `TSK-${String(sequence).padStart(3, '0')}`;
}

module.exports = { formatTaskId };
