const mongoose = require('mongoose');
const {
  DEPARTMENTS,
  TASK_ID_PATTERN,
  TASK_PRIORITIES,
  TASK_STATUS,
  TASK_STATUSES,
} = require('../constants/domain');
const { isValidDate, toUtcDateOnly } = require('../utils/dateOnly');
const { EMAIL_PATTERN, normalizeEmail, normalizeEmployeeId } = require('../utils/validation');

const employeeSnapshotSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Snapshot Employee ID is required.'],
      minlength: [2, 'Snapshot Employee ID must be 2-30 characters.'],
      maxlength: [30, 'Snapshot Employee ID must be 2-30 characters.'],
      set: normalizeEmployeeId,
    },
    fullName: {
      type: String,
      required: [true, 'Snapshot Full Name is required.'],
      trim: true,
      minlength: [2, 'Snapshot Full Name must be 2-100 characters.'],
      maxlength: [100, 'Snapshot Full Name must be 2-100 characters.'],
    },
    email: {
      type: String,
      required: [true, 'Snapshot email is required.'],
      match: [EMAIL_PATTERN, 'Snapshot email must be valid.'],
      set: normalizeEmail,
    },
    department: {
      type: String,
      required: [true, 'Snapshot department is required.'],
      enum: {
        values: DEPARTMENTS,
        message: `Snapshot department must be one of: ${DEPARTMENTS.join(', ')}.`,
      },
    },
  },
  { _id: false, versionKey: false },
);

const taskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      required: [true, 'Task ID is required.'],
      unique: true,
      immutable: true,
      uppercase: true,
      trim: true,
      match: [TASK_ID_PATTERN, 'Task ID must use the TSK-001 format.'],
    },
    title: {
      type: String,
      required: [true, 'Title is required.'],
      trim: true,
      minlength: [3, 'Title must be 3-150 characters.'],
      maxlength: [150, 'Title must be 3-150 characters.'],
    },
    description: {
      type: String,
      required: [true, 'Description is required.'],
      trim: true,
      minlength: [1, 'Description must be 1-2,000 characters.'],
      maxlength: [2000, 'Description must be 1-2,000 characters.'],
    },
    assignedEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Assigned Employee is required.'],
    },
    employeeSnapshot: {
      type: employeeSnapshotSchema,
      required: [true, 'Employee snapshot is required.'],
    },
    department: {
      type: String,
      required: [true, 'Department is required.'],
      enum: {
        values: DEPARTMENTS,
        message: `Department must be one of: ${DEPARTMENTS.join(', ')}.`,
      },
    },
    priority: {
      type: String,
      required: [true, 'Priority is required.'],
      enum: {
        values: TASK_PRIORITIES,
        message: `Priority must be one of: ${TASK_PRIORITIES.join(', ')}.`,
      },
    },
    status: {
      type: String,
      required: [true, 'Status is required.'],
      enum: {
        values: TASK_STATUSES,
        message: `Status must be one of: ${TASK_STATUSES.join(', ')}.`,
      },
      default: TASK_STATUS.TODO,
    },
    startDate: {
      type: Date,
      required: [true, 'Start Date is required.'],
      set: toUtcDateOnly,
      validate: {
        validator: (value) => value == null || isValidDate(value),
        message: 'Start Date must be a valid date.',
      },
    },
    dueDate: {
      type: Date,
      required: [true, 'Due Date is required.'],
      set: toUtcDateOnly,
      validate: [
        {
          validator: (value) => value == null || isValidDate(value),
          message: 'Due Date must be a valid date.',
        },
        {
          validator: function dueDateOnOrAfterStart(value) {
            if (
              value == null ||
              this.startDate == null ||
              !isValidDate(value) ||
              !isValidDate(this.startDate)
            ) {
              return true;
            }

            return value.getTime() >= this.startDate.getTime();
          },
          message: 'Due Date cannot be earlier than Start Date.',
        },
      ],
    },
    completedDate: {
      type: Date,
      default: null,
      validate: [
        {
          validator: (value) => value == null || isValidDate(value),
          message: 'Completed Date must be a valid date.',
        },
        {
          validator: function completedDateRequired(value) {
            return this.status !== TASK_STATUS.COMPLETED || value != null;
          },
          message: 'Completed Date is required when Status is Completed.',
        },
        {
          validator: function completedDateOnlyWhenCompleted(value) {
            return this.status === TASK_STATUS.COMPLETED || value == null;
          },
          message: 'Completed Date can only be set when Status is Completed.',
        },
      ],
    },
  },
  {
    timestamps: true,
    collection: 'tasks',
    toJSON: { versionKey: false },
  },
);

taskSchema.index({ assignedEmployee: 1, status: 1 });
taskSchema.index({ status: 1, dueDate: 1 });
taskSchema.index({ department: 1, priority: 1, status: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ title: 1 });
taskSchema.index({ 'employeeSnapshot.fullName': 1 });

module.exports = mongoose.model('Task', taskSchema);
