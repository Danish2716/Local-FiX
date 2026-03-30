const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Worker = require('../models/Worker');
const { asyncHandler } = require('../middleware/errorHandler');
const { verifyAndConsumeOTP } = require('./otpController');

// ─── Generate JWT ─────────────────────────────────────────────────────────
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// ─── Format user/worker response (remove sensitive fields) ────────────────
const formatUserResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role || 'user',
  isEmailVerified: user.isEmailVerified,
  profilePic: user.profilePic,
  location: user.location,
  createdAt: user.createdAt,
});

const formatWorkerResponse = (worker) => ({
  _id: worker._id,
  name: worker.name,
  email: worker.email,
  phone: worker.phone,
  role: 'worker',
  category: worker.category,
  subSkills: worker.subSkills,
  baseRate: worker.baseRate,
  isOnline: worker.isOnline,
  isBusy: worker.isBusy,
  rating: worker.rating,
  verification: worker.verification,
  location: worker.location,
  experience: worker.experience,
  isEmailVerified: worker.isEmailVerified,
  totalJobsCompleted: worker.totalJobsCompleted,
  createdAt: worker.createdAt,
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER CONTROLLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/auth/user/signup
const userSignup = asyncHandler(async (req, res) => {
  const { name, email, phone, password, otp } = req.body;

  if (!name || !email || !phone || !password || !otp) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  // Check duplicate email
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already registered.' });
  }

  // Verify OTP
  const otpResult = await verifyAndConsumeOTP(email, otp, 'user_signup');
  if (!otpResult.valid) {
    return res.status(400).json({ success: false, message: otpResult.message });
  }

  // Create user
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    phone,
    password,
    isEmailVerified: true,
  });

  const token = generateToken(user._id, 'user');

  res.status(201).json({
    success: true,
    message: 'User registered successfully!',
    token,
    user: formatUserResponse(user),
  });
});

// POST /api/auth/user/login
const userLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  // Find user with password
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const token = generateToken(user._id, 'user');

  res.status(200).json({
    success: true,
    message: 'Logged in successfully!',
    token,
    user: formatUserResponse(user),
  });
});

// GET /api/auth/user/me  (protected)
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  res.status(200).json({ success: true, user: formatUserResponse(user) });
});

// PUT /api/auth/user/profile  (protected)
const updateUserProfile = asyncHandler(async (req, res) => {
  const { name, phone, location } = req.body;
  const updateData = {};
  if (name) updateData.name = name;
  if (phone) updateData.phone = phone;
  if (location) updateData.location = location;

  const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });
  res.status(200).json({ success: true, message: 'Profile updated.', user: formatUserResponse(user) });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WORKER CONTROLLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/auth/worker/signup
const workerSignup = asyncHandler(async (req, res) => {
  const { name, email, phone, password, aadharNumber, category, subSkills, baseRate, otp } = req.body;

  if (!name || !email || !phone || !password || !aadharNumber || !category || !otp) {
    return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
  }

  // Check duplicate email
  const existing = await Worker.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already registered as a worker.' });
  }

  // Verify OTP
  const otpResult = await verifyAndConsumeOTP(email, otp, 'worker_signup');
  if (!otpResult.valid) {
    return res.status(400).json({ success: false, message: otpResult.message });
  }

  // Create worker
  const worker = await Worker.create({
    name,
    email: email.toLowerCase(),
    phone,
    password,
    aadharNumber,
    category,
    subSkills: subSkills || [],
    baseRate: baseRate || 299,
    isEmailVerified: true,
  });

  const token = generateToken(worker._id, 'worker');

  res.status(201).json({
    success: true,
    message: 'Worker registered successfully!',
    token,
    worker: formatWorkerResponse(worker),
  });
});

// POST /api/auth/worker/login
const workerLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const worker = await Worker.findOne({ email: email.toLowerCase() }).select('+password');
  if (!worker) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  if (!worker.isActive) {
    return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
  }

  const isMatch = await worker.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const token = generateToken(worker._id, 'worker');

  res.status(200).json({
    success: true,
    message: 'Logged in successfully!',
    token,
    worker: formatWorkerResponse(worker),
  });
});

// GET /api/auth/worker/me  (protected)
const getWorkerProfile = asyncHandler(async (req, res) => {
  const worker = await Worker.findById(req.user._id);
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found.' });

  res.status(200).json({ success: true, worker: formatWorkerResponse(worker) });
});

// PUT /api/auth/worker/profile  (protected, worker only)
const updateWorkerProfile = asyncHandler(async (req, res) => {
  const { name, phone, category, subSkills, baseRate, experience, location } = req.body;
  const updateData = {};
  if (name) updateData.name = name;
  if (phone) updateData.phone = phone;
  if (category) updateData.category = category;
  if (subSkills) updateData.subSkills = subSkills;
  if (baseRate) updateData.baseRate = baseRate;
  if (experience !== undefined) updateData.experience = experience;
  if (location) updateData.location = location;

  const worker = await Worker.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });
  res.status(200).json({ success: true, message: 'Profile updated.', worker: formatWorkerResponse(worker) });
});

// PUT /api/auth/worker/availability  (protected, worker only)
const toggleAvailability = asyncHandler(async (req, res) => {
  const { isOnline } = req.body;
  if (typeof isOnline !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isOnline must be a boolean.' });
  }

  const worker = await Worker.findByIdAndUpdate(
    req.user._id,
    { isOnline },
    { new: true }
  );

  // Emit to socket (handled by socket handler separately)
  const io = req.app.get('io');
  if (io) {
    io.emit('workerAvailabilityChanged', { workerId: worker._id, isOnline });
  }

  res.status(200).json({
    success: true,
    message: `You are now ${isOnline ? 'online' : 'offline'}.`,
    isOnline: worker.isOnline,
  });
});

module.exports = {
  userSignup,
  userLogin,
  getUserProfile,
  updateUserProfile,
  workerSignup,
  workerLogin,
  getWorkerProfile,
  updateWorkerProfile,
  toggleAvailability,
};
