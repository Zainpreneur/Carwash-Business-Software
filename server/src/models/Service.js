const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, enum: ['basic', 'premium', 'detailing', 'addon'], default: 'basic' },
    price: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 5, default: 30 },
    vehicleTypePricing: {
      sedan: { type: Number },
      suv: { type: Number },
      truck: { type: Number },
      van: { type: Number },
      motorcycle: { type: Number },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
