const mongoose = require('mongoose');
const { DEPARTMENTS, EMPLOYEE_STATUS, EMPLOYEE_STATUSES } = require('../constants/domain');
const { compareDateOnly, isValidDate, toUtcDateOnly } = require('../utils/dateOnly');
const {
  EMAIL_PATTERN,
  isValidPhone,
  isValidSkillsArray,
  normalizeEmail,
  normalizeEmployeeId,
  normalizeSkills,
} = require('../utils/validation');

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required.'],
      unique: true,
      minlength: [2, 'Employee ID must be 2-30 characters.'],
      maxlength: [30, 'Employee ID must be 2-30 characters.'],
      set: normalizeEmployeeId,
    },
    fullName: {
      type: String,
      required: [true, 'Full Name is required.'],
      trim: true,
      minlength: [2, 'Full Name must be 2-100 characters.'],
      maxlength: [100, 'Full Name must be 2-100 characters.'],
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      match: [EMAIL_PATTERN, 'Email must be valid.'],
      set: normalizeEmail,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required.'],
      trim: true,
      validate: {
        validator: isValidPhone,
        message: 'Phone must contain 7-15 digits and use only digits, spaces, +, -, or parentheses.',
      },
    },
    department: {
      type: String,
      required: [true, 'Department is required.'],
      enum: {
        values: DEPARTMENTS,
        message: `Department must be one of: ${DEPARTMENTS.join(', ')}.`,
      },
    },
    role: {
      type: String,
      required: [true, 'Role is required.'],
      trim: true,
      minlength: [2, 'Role must be 2-80 characters.'],
      maxlength: [80, 'Role must be 2-80 characters.'],
    },
    joiningDate: {
      type: Date,
      required: [true, 'Joining Date is required.'],
      set: toUtcDateOnly,
      validate: {
        validator: (value) => value == null || isValidDate(value),
        message: 'Joining Date must be a valid date.',
      },
    },
    status: {
      type: String,
      required: [true, 'Status is required.'],
      enum: {
        values: EMPLOYEE_STATUSES,
        message: `Status must be one of: ${EMPLOYEE_STATUSES.join(', ')}.`,
      },
      default: EMPLOYEE_STATUS.ACTIVE,
    },
    skills: {
      type: [String],
      default: [],
      set: normalizeSkills,
      validate: [
        {
          validator: (value) => Array.isArray(value) && value.length <= 20,
          message: 'Skills cannot contain more than 20 entries.',
        },
        {
          validator: isValidSkillsArray,
          message: 'Each skill must be 1-50 characters and empty skills are not allowed.',
        },
      ],
    },
    leaveStart: {
      type: Date,
      default: null,
      required: function leaveStartRequired() {
        return this.status === EMPLOYEE_STATUS.ON_LEAVE;
      },
      set: toUtcDateOnly,
      validate: [
        {
          validator: function leaveStartOnlyWhenOnLeave(value) {
            return this.status === EMPLOYEE_STATUS.ON_LEAVE || value == null;
          },
          message: 'Leave Start Date is only allowed when Status is On Leave.',
        },
        {
          validator: (value) => value == null || isValidDate(value),
          message: 'Leave Start Date must be a valid date.',
        },
      ],
    },
    leaveEnd: {
      type: Date,
      default: null,
      required: function leaveEndRequired() {
        return this.status === EMPLOYEE_STATUS.ON_LEAVE;
      },
      set: toUtcDateOnly,
      validate: [
        {
          validator: function leaveEndOnlyWhenOnLeave(value) {
            return this.status === EMPLOYEE_STATUS.ON_LEAVE || value == null;
          },
          message: 'Leave End Date is only allowed when Status is On Leave.',
        },
        {
          validator: (value) => value == null || isValidDate(value),
          message: 'Leave End Date must be a valid date.',
        },
        {
          validator: function leaveEndOnOrAfterStart(value) {
            if (
              this.status !== EMPLOYEE_STATUS.ON_LEAVE ||
              value == null ||
              this.leaveStart == null
            ) {
              return true;
            }

            const comparison = compareDateOnly(value, this.leaveStart);
            return comparison === null || comparison >= 0;
          },
          message: 'Leave End Date must be on or after Leave Start Date.',
        },
      ],
    },
    activeTaskCount: {
      type: Number,
      default: 0,
      min: [0, 'Active task count cannot be negative.'],
      select: false,
    },
  },
  {
    timestamps: true,
    collection: 'employees',
    toJSON: {
      versionKey: false,
      transform(_document, result) {
        delete result.activeTaskCount;
        return result;
      },
    },
  },
);

employeeSchema.index({ department: 1, status: 1, fullName: 1 });
employeeSchema.index({ fullName: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
