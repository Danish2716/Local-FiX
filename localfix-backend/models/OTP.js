const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['user_signup', 'worker_signup', 'login', 'password_reset'],
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
      max: 5, // Max 5 wrong attempts before OTP is invalidated
    },
    // TTL index: MongoDB auto-deletes this doc after expiry
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
      index: { expires: 0 }, // TTL index — MongoDB deletes when expiresAt < now
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: one active OTP per email+purpose
otpSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model('OTP', otpSchema);
