const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number },
    color: { type: String, trim: true },
    plateNumber: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, enum: ['sedan', 'suv', 'truck', 'van', 'motorcycle', 'other'], default: 'sedan' },
  },
  { timestamps: true }
);

vehicleSchema.index({ plateNumber: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);
