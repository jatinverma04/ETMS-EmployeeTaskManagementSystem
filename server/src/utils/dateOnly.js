const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Date-only values are stored as UTC midnight so comparisons do not depend on the server timezone.
 * Invalid input is returned as an Invalid Date so schema validation can reject it.
 */
function toUtcDateOnly(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    if (!isValidDate(value)) {
      return new Date(Number.NaN);
    }

    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  if (typeof value !== 'string') {
    return new Date(Number.NaN);
  }

  const match = DATE_ONLY_PATTERN.exec(value.trim());

  if (!match) {
    return new Date(Number.NaN);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return new Date(Number.NaN);
  }

  return date;
}

function formatDateOnly(value) {
  const date = toUtcDateOnly(value);

  if (!isValidDate(date)) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function compareDateOnly(left, right) {
  const leftDate = toUtcDateOnly(left);
  const rightDate = toUtcDateOnly(right);

  if (!isValidDate(leftDate) || !isValidDate(rightDate)) {
    return null;
  }

  return Math.sign(leftDate.getTime() - rightDate.getTime());
}

module.exports = {
  isValidDate,
  toUtcDateOnly,
  formatDateOnly,
  compareDateOnly,
};
