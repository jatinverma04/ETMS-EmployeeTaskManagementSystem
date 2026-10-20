const { body } = require('express-validator');
const { DEPARTMENTS, EMPLOYEE_STATUSES } = require('../constants/domain');
const { EMPLOYEE_WRITE_FIELDS } = require('../constants/employee');
const { EMAIL_PATTERN, isValidPhone, isValidSkillsArray } = require('../utils/validation');
const { isValidDate, toUtcDateOnly } = require('../utils/dateOnly');
const AppError = require('../utils/AppError');

function rejectUnknownFields(req, res, next) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return next(
      new AppError('Validation failed.', 400, [
        { field: 'body', message: 'Request body must be a JSON object.' },
      ]),
    );
  }

  const unknownFields = Object.keys(req.body).filter(
    (field) => !EMPLOYEE_WRITE_FIELDS.includes(field),
  );

  if (unknownFields.length > 0) {
    return next(
      new AppError(
        'Validation failed.',
        400,
        unknownFields.map((field) => ({
          field,
          message: `Field "${field}" is not allowed.`,
        })),
      ),
    );
  }

  return next();
}

function withRequired(chain, required, message) {
  return required
    ? chain.exists({ checkFalsy: true }).withMessage(message)
    : chain.optional();
}

function textField(field, label, { required, minLength, maxLength }) {
  return withRequired(body(field), required, `${label} is required.`)
    .isString()
    .withMessage(`${label} must be a string.`)
    .trim()
    .isLength({ min: minLength, max: maxLength })
    .withMessage(`${label} must be ${minLength}-${maxLength} characters.`);
}

function dateOnlyValidator(label) {
  return (value) => {
    if (!isValidDate(toUtcDateOnly(value))) {
      throw new Error(`${label} must be a valid date in YYYY-MM-DD format.`);
    }

    return true;
  };
}

function skillsValidator(value) {
  if (!isValidSkillsArray(value)) {
    throw new Error('Skills must be an array of at most 20 entries, each 1-50 characters.');
  }

  return true;
}

function buildEmployeeValidators(required) {
  return [
    rejectUnknownFields,
    textField('employeeId', 'Employee ID', {
      required,
      minLength: 2,
      maxLength: 30,
    }),
    textField('fullName', 'Full Name', {
      required,
      minLength: 2,
      maxLength: 100,
    }),
    withRequired(body('email'), required, 'Email is required.')
      .isString()
      .withMessage('Email must be a string.')
      .trim()
      .matches(EMAIL_PATTERN)
      .withMessage('Email must be valid.'),
    withRequired(body('phone'), required, 'Phone is required.')
      .isString()
      .withMessage('Phone must be a string.')
      .trim()
      .custom(isValidPhone)
      .withMessage('Phone must contain 7-15 digits and use only digits, spaces, +, -, or parentheses.'),
    withRequired(body('department'), required, 'Department is required.')
      .isString()
      .withMessage('Department must be a string.')
      .isIn(DEPARTMENTS)
      .withMessage(`Department must be one of: ${DEPARTMENTS.join(', ')}.`),
    textField('role', 'Role', {
      required,
      minLength: 2,
      maxLength: 80,
    }),
    withRequired(body('joiningDate'), required, 'Joining Date is required.')
      .isString()
      .withMessage('Joining Date must be a string.')
      .custom(dateOnlyValidator('Joining Date')),
    body('status')
      .optional()
      .isString()
      .withMessage('Status must be a string.')
      .isIn(EMPLOYEE_STATUSES)
      .withMessage(`Status must be one of: ${EMPLOYEE_STATUSES.join(', ')}.`),
    body('skills')
      .optional()
      .isArray()
      .withMessage('Skills must be an array.')
      .custom(skillsValidator),
    body('leaveStart')
      .optional({ nullable: true })
      .isString()
      .withMessage('Leave Start Date must be a string.')
      .custom(dateOnlyValidator('Leave Start Date')),
    body('leaveEnd')
      .optional({ nullable: true })
      .isString()
      .withMessage('Leave End Date must be a string.')
      .custom(dateOnlyValidator('Leave End Date')),
  ];
}

const createEmployeeValidators = buildEmployeeValidators(true);
const updateEmployeeValidators = buildEmployeeValidators(false);

module.exports = {
  createEmployeeValidators,
  updateEmployeeValidators,
};
