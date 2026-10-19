const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Counter name is required.'],
      unique: true,
      trim: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Counter sequence cannot be negative.'],
      validate: {
        validator: Number.isInteger,
        message: 'Counter sequence must be an integer.',
      },
    },
  },
  {
    collection: 'counters',
    versionKey: false,
  },
);

module.exports = mongoose.model('Counter', counterSchema);
