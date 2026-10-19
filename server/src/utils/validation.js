const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_CHARACTER_PATTERN = /^[+()\-\s\d]+$/;

function normalizeEmployeeId(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function normalizeSkills(value) {
  if (!Array.isArray(value)) {
    return value;
  }

  const normalized = value.map((skill) => (typeof skill === 'string' ? skill.trim() : skill));
  return [...new Set(normalized)];
}

function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_PATTERN.test(value);
}

function isValidPhone(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();

  if (!PHONE_CHARACTER_PATTERN.test(trimmed)) {
    return false;
  }

  const digitCount = trimmed.replace(/\D/g, '').length;
  return digitCount >= 7 && digitCount <= 15;
}

function isValidSkillsArray(value) {
  return (
    Array.isArray(value) &&
    value.length <= 20 &&
    value.every((skill) => typeof skill === 'string' && skill.length >= 1 && skill.length <= 50)
  );
}

module.exports = {
  EMAIL_PATTERN,
  normalizeEmployeeId,
  normalizeEmail,
  normalizeSkills,
  isValidEmail,
  isValidPhone,
  isValidSkillsArray,
};
