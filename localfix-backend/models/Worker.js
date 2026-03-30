const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const workerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    aadharNumber: {
      type: String,
      required: [true, 'Aadhar number is required'],
      trim: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['worker'],
      default: 'worker',
    },
    // Primary service category
    category: {
      type: String,
      required: [true, 'Service category is required'],
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
    // Sub-skills within the category
    subSkills: [
      {
        type: String,
        trim: true,
      },
    ],
    // Hourly rate
    baseRate: {
      type: Number,
      default: 299,
      min: 100,
    },
    // Online/offline availability
    isOnline: {
      type: Boolean,
      default: false,
    },
    // Currently on a job
    isBusy: {
      type: Boolean,
      default: false,
    },
    // Location (GeoJSON for geospatial queries)
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [75.8573, 30.9010], // Default: Ludhiana
      },
      city: { type: String, default: 'Ludhiana' },
      address: { type: String, default: '' },
      serviceRadius: { type: Number, default: 5 }, // km
    },
    // Verification status
    verification: {
      aadhar: { type: Boolean, default: false },
      certificate: { type: Boolean, default: false },
      backgroundCheck: { type: Boolean, default: false },
    },
    profilePic: {
      type: String,
      default: null,
    },
    experience: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Rating system
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    // Job stats
    totalJobsCompleted: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    // Bank details (stored encrypted in production)
    bankDetails: {
      accountHolder: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Socket ID for real-time tracking
    socketId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for geospatial queries (find nearby workers)
workerSchema.index({ location: '2dsphere' });
// Index for fast category+online filtering
workerSchema.index({ category: 1, isOnline: 1, isBusy: 1 });

// Hash password before saving
workerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
workerSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual: initials
workerSchema.virtual('initials').get(function () {
  return this.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

module.exports = mongoose.model('Worker', workerSchema);
