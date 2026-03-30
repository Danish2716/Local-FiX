const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    // References
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Worker',
      default: null,
    },

    // Service details
    category: {
      type: String,
      required: true,
      enum: [
        'electrician',
        'plumber',
        'ac_technician',
        'carpenter',
        'mechanic',
        'cleaning',
        'painter',
        'appliance_repair',
      ],
    },
    subCategory: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
      maxlength: 500,
    },

    // Location where service is needed
    serviceLocation: {
      address: { type: String, default: '' },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },

    // Booking status lifecycle
    // requested → accepted → on_the_way → arrived → in_progress → completed
    // Or: requested → rejected / cancelled
    status: {
      type: String,
      enum: [
        'requested',
        'searching',     // Searching for worker
        'accepted',      // Worker accepted
        'on_the_way',   // Worker is traveling
        'arrived',       // Worker reached location
        'in_progress',   // Work started
        'completed',     // Work done
        'cancelled',     // Cancelled by user/worker
        'rejected',      // All nearby workers rejected
      ],
      default: 'requested',
    },

    // Status history for tracking
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],

    // Scheduling
    scheduledAt: {
      type: Date,
      default: null, // null = immediate booking
    },

    // Payment
    pricing: {
      baseRate: { type: Number, default: 0 },
      hours: { type: Number, default: 0 },
      materialCost: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card', 'wallet'],
      default: 'cash',
    },

    // Review (after completion)
    review: {
      rating: { type: Number, min: 1, max: 5, default: null },
      comment: { type: String, default: '' },
      reviewedAt: { type: Date, default: null },
    },

    // Cancellation
    cancellation: {
      reason: { type: String, default: '' },
      cancelledBy: { type: String, enum: ['user', 'worker', 'system', ''], default: '' },
      cancelledAt: { type: Date, default: null },
    },

    // Timestamps for key events
    acceptedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // OTP to confirm worker arrival
    arrivalOTP: {
      code: { type: String, default: null },
      verified: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ worker: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
