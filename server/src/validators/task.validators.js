const { body } = require('express-validator');
const { DEPARTMENTS, TASK_PRIORITIES, TASK_STATUSES } = require('../constants/domain');
const { TASK_WRITE_FIELDS, TASK_STATUS_WRITE_FIELDS } = require('../constants/task');
const { isValidDate, toUtcDateOnly } = require('../utils/dateOnly');
const AppError = require('../utils/AppError');

function rejectUnknownFields(allowedFields) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return next(
        new AppError('Validation failed.', 400, [
          { field: 'body', message: 'Request body must be a JSON object.' },
        ]),
      );
    }

    const unknownFields = Object.keys(req.body).filter(
      (field) => !allowedFields.includes(field),
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
  };
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

function buildTaskValidators(required) {
  return [
    rejectUnknownFields(TASK_WRITE_FIELDS),
    textField('title', 'Title', { required, minLength: 3, maxLength: 150 }),
    textField('description', 'Description', { required, minLength: 1, maxLength: 2000 }),
    withRequired(body('assignedEmployee'), required, 'Assigned Employee is required.')
      .isString()
      .withMessage('Assigned Employee must be a string.')
      .trim()
      .isMongoId()
      .withMessage('Assigned Employee must be a valid MongoDB ObjectId.'),
    withRequired(body('department'), required, 'Department is required.')
      .isString()
      .withMessage('Department must be a string.')
      .isIn(DEPARTMENTS)
      .withMessage(`Department must be one of: ${DEPARTMENTS.join(', ')}.`),
    withRequired(body('priority'), required, 'Priority is required.')
      .isString()
      .withMessage('Priority must be a string.')
      .isIn(TASK_PRIORITIES)
      .withMessage(`Priority must be one of: ${TASK_PRIORITIES.join(', ')}.`),
    withRequired(body('startDate'), required, 'Start Date is required.')
      .isString()
      .withMessage('Start Date must be a string.')
      .custom(dateOnlyValidator('Start Date')),
    withRequired(body('dueDate'), required, 'Due Date is required.')
      .isString()
      .withMessage('Due Date must be a string.')
      .custom(dateOnlyValidator('Due Date')),
  ];
}

const createTaskValidators = buildTaskValidators(true);
const updateTaskValidators = buildTaskValidators(false);

const updateTaskStatusValidators = [
  rejectUnknownFields(TASK_STATUS_WRITE_FIELDS),
  body('status')
    .exists({ checkFalsy: true })
    .withMessage('Status is required.')
    .isString()
    .withMessage('Status must be a string.')
    .isIn(TASK_STATUSES)
    .withMessage(`Status must be one of: ${TASK_STATUSES.join(', ')}.`),
];

module.exports = {
  createTaskValidators,
  updateTaskValidators,
  updateTaskStatusValidators,
};
