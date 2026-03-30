const { body } = require('express-validator');
const OTP = require('../models/OTP');
const User = require('../models/User');
const Worker = require('../models/Worker');
const { sendOTPEmail } = require('../config/mailer');
const { asyncHandler } = require('../middleware/errorHandler');

// ─── Generate a 6-digit OTP ───────────────────────────────────────────────
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ─── POST /api/otp/send ───────────────────────────────────────────────────
// Send OTP to email
const sendOTP = asyncHandler(async (req, res) => {
  const { email, purpose, name } = req.body;

  if (!email || !purpose) {
    return res.status(400).json({ success: false, message: 'Email and purpose are required.' });
  }

  const validPurposes = ['user_signup', 'worker_signup', 'login', 'password_reset'];
  if (!validPurposes.includes(purpose)) {
    return res.status(400).json({ success: false, message: 'Invalid OTP purpose.' });
  }

  // For signup: check if email already registered
  if (purpose === 'user_signup') {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email is already registered as a user.' });
    }
  }
  if (purpose === 'worker_signup') {
    const existingWorker = await Worker.findOne({ email: email.toLowerCase() });
    if (existingWorker) {
      return res.status(409).json({ success: false, message: 'Email is already registered as a worker.' });
    }
  }

  // Delete any existing OTPs for this email+purpose
  await OTP.deleteMany({ email: email.toLowerCase(), purpose });

  // Generate new OTP
  const otp = generateOTP();

  // Store OTP in DB (expires in 5 minutes via TTL index)
  await OTP.create({
    email: email.toLowerCase(),
    otp,
    purpose,
  });

  // Send email
  await sendOTPEmail(email, otp, name || 'User');

  res.status(200).json({
    success: true,
    message: `OTP sent to ${email}. Valid for 5 minutes.`,
    // In development, return OTP for easy testing
    ...(process.env.NODE_ENV === 'development' && { devOTP: otp }),
  });
});

// ─── POST /api/otp/verify ─────────────────────────────────────────────────
// Verify OTP (without consuming it — use this for pre-verification)
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp, purpose } = req.body;

  if (!email || !otp || !purpose) {
    return res.status(400).json({ success: false, message: 'Email, OTP, and purpose are required.' });
  }

  const otpRecord = await OTP.findOne({
    email: email.toLowerCase(),
    purpose,
    isUsed: false,
  });

  if (!otpRecord) {
    return res.status(400).json({ success: false, message: 'OTP not found or expired. Please request a new one.' });
  }

  // Check max attempts
  if (otpRecord.attempts >= 5) {
    await OTP.deleteOne({ _id: otpRecord._id });
    return res.status(400).json({ success: false, message: 'Too many wrong attempts. Please request a new OTP.' });
  }

  if (otpRecord.otp !== otp.toString()) {
    // Increment attempts
    otpRecord.attempts += 1;
    await otpRecord.save();
    return res.status(400).json({
      success: false,
      message: `Incorrect OTP. ${5 - otpRecord.attempts} attempts remaining.`,
    });
  }

  // Mark as used
  otpRecord.isUsed = true;
  await otpRecord.save();

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully.',
  });
});

// ─── Helper: Verify and consume OTP (used internally in signup/login) ────
const verifyAndConsumeOTP = async (email, otp, purpose) => {
  const otpRecord = await OTP.findOne({
    email: email.toLowerCase(),
    purpose,
    isUsed: false,
  });

  if (!otpRecord) return { valid: false, message: 'OTP not found or expired.' };
  if (otpRecord.attempts >= 5) {
    await OTP.deleteOne({ _id: otpRecord._id });
    return { valid: false, message: 'Too many wrong attempts. Please request a new OTP.' };
  }
  if (otpRecord.otp !== otp.toString()) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    return { valid: false, message: `Incorrect OTP. ${5 - otpRecord.attempts} attempts remaining.` };
  }

  // Consume it
  await OTP.deleteOne({ _id: otpRecord._id });
  return { valid: true };
};

module.exports = { sendOTP, verifyOTP, verifyAndConsumeOTP };
