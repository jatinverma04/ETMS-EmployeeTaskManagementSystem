const FORMULA_PREFIX_PATTERN = /^[\s]*[=+\-@]/;

/**
 * Spreadsheet applications can evaluate a cell as a formula when it starts
 * with =, +, -, or @ (optionally after leading whitespace). Prefixing the cell
 * with an apostrophe forces it to remain text after CSV import.
 */
function protectCsvFormula(value) {
  if (FORMULA_PREFIX_PATTERN.test(value)) {
    return `'${value}`;
  }

  return value;
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = protectCsvFormula(String(value));

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function buildCsvRow(values) {
  return values.map(escapeCsvValue).join(',');
}

module.exports = {
  protectCsvFormula,
  escapeCsvValue,
  buildCsvRow,
};
