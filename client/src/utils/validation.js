import { DEPARTMENTS, EMPLOYEE_STATUSES, TASK_PRIORITIES } from './constants';
import { isValidDateOnly } from './date';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_CHARACTER_PATTERN = /^[+()\-\s\d]+$/;

export function isValidPhone(value) {
  const trimmed = String(value || '').trim();

  if (!PHONE_CHARACTER_PATTERN.test(trimmed)) {
    return false;
  }

  const digitCount = trimmed.replace(/\D/g, '').length;
  return digitCount >= 7 && digitCount <= 15;
}

export function normalizeSkills(skills) {
  return [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))];
}

export function validateEmployee(values) {
  const errors = {};
  const employeeId = values.employeeId.trim();
  const fullName = values.fullName.trim();
  const email = values.email.trim();
  const role = values.role.trim();
  const skills = normalizeSkills(values.skills);

  if (employeeId.length < 2 || employeeId.length > 30) {
    errors.employeeId = 'Employee ID must be 2-30 characters.';
  }

  if (fullName.length < 2 || fullName.length > 100) {
    errors.fullName = 'Full Name must be 2-100 characters.';
  }

  if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Email must be valid.';
  }

  if (!isValidPhone(values.phone)) {
    errors.phone =
      'Phone must contain 7-15 digits and use only digits, spaces, +, -, or parentheses.';
  }

  if (!DEPARTMENTS.includes(values.department)) {
    errors.department = 'Select a department.';
  }

  if (role.length < 2 || role.length > 80) {
    errors.role = 'Role must be 2-80 characters.';
  }

  if (!isValidDateOnly(values.joiningDate)) {
    errors.joiningDate = 'Enter a valid joining date in YYYY-MM-DD format.';
  }

  if (!EMPLOYEE_STATUSES.includes(values.status)) {
    errors.status = 'Select a status.';
  }

  if (skills.length > 20) {
    errors.skills = 'Skills cannot contain more than 20 entries.';
  } else if (skills.some((skill) => skill.length < 1 || skill.length > 50)) {
    errors.skills = 'Each skill must be 1-50 characters.';
  }

  if (values.status === 'On Leave') {
    if (!isValidDateOnly(values.leaveStart)) {
      errors.leaveStart = 'Enter a valid leave start date in YYYY-MM-DD format.';
    }

    if (!isValidDateOnly(values.leaveEnd)) {
      errors.leaveEnd = 'Enter a valid leave end date in YYYY-MM-DD format.';
    }

    if (
      isValidDateOnly(values.leaveStart) &&
      isValidDateOnly(values.leaveEnd) &&
      values.leaveEnd < values.leaveStart
    ) {
      errors.leaveEnd = 'Leave End Date must be on or after Leave Start Date.';
    }
  }

  return errors;
}

export function validateTask(values) {
  const errors = {};
  const title = values.title.trim();
  const description = values.description.trim();

  if (title.length < 3 || title.length > 150) {
    errors.title = 'Title must be 3-150 characters.';
  }

  if (description.length < 1 || description.length > 2000) {
    errors.description = 'Description must be 1-2,000 characters.';
  }

  if (!values.assignedEmployee) {
    errors.assignedEmployee = 'Select an assigned employee.';
  }

  if (!DEPARTMENTS.includes(values.department)) {
    errors.department = 'Select a department.';
  }

  if (!TASK_PRIORITIES.includes(values.priority)) {
    errors.priority = 'Select a priority.';
  }

  if (!isValidDateOnly(values.startDate)) {
    errors.startDate = 'Enter a valid start date in YYYY-MM-DD format.';
  }

  if (!isValidDateOnly(values.dueDate)) {
    errors.dueDate = 'Enter a valid due date in YYYY-MM-DD format.';
  }

  if (
    isValidDateOnly(values.startDate) &&
    isValidDateOnly(values.dueDate) &&
    values.dueDate < values.startDate
  ) {
    errors.dueDate = 'Due Date cannot be earlier than Start Date.';
  }

  return errors;
}
