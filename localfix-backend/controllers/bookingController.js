const Booking = require('../models/Booking');
const Worker = require('../models/Worker');
const { asyncHandler } = require('../middleware/errorHandler');

// ─── Helper: find best available worker ──────────────────────────────────
const findNearbyWorker = async (category, userLat, userLng) => {
  const radiusInMeters = 10000; // 10km radius

  // Try geospatial search first
  if (userLat && userLng) {
    const workers = await Worker.find({
      category,
      isOnline: true,
      isBusy: false,
      isActive: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(userLng), parseFloat(userLat)],
          },
          $maxDistance: radiusInMeters,
        },
      },
    }).limit(5);

    if (workers.length > 0) return workers[0];
  }

  // Fallback: any online, non-busy worker in this category
  return await Worker.findOne({ category, isOnline: true, isBusy: false, isActive: true });
};

// ─── POST /api/bookings ───────────────────────────────────────────────────
// User creates a booking
const createBooking = asyncHandler(async (req, res) => {
  const {
    category,
    subCategory,
    description,
    serviceLocation,
    scheduledAt,
    paymentMethod,
    workerId, // Optional: book a specific worker
  } = req.body;

  if (!category) {
    return res.status(400).json({ success: false, message: 'Service category is required.' });
  }

  // Validate service location
  const userLat = serviceLocation?.coordinates?.lat || req.user?.location?.coordinates?.lat;
  const userLng = serviceLocation?.coordinates?.lng || req.user?.location?.coordinates?.lng;

  // Find a worker
  let assignedWorker = null;
  if (workerId) {
    // User picked a specific worker
    assignedWorker = await Worker.findOne({ _id: workerId, isOnline: true, isBusy: false, isActive: true });
    if (!assignedWorker) {
      return res.status(400).json({ success: false, message: 'Selected worker is not available.' });
    }
  } else {
    // Auto-assign nearby worker
    assignedWorker = await findNearbyWorker(category, userLat, userLng);
  }

  // Generate arrival OTP
  const arrivalOTPCode = Math.floor(1000 + Math.random() * 9000).toString();

  const booking = await Booking.create({
    user: req.user._id,
    worker: assignedWorker ? assignedWorker._id : null,
    category,
    subCategory: subCategory || '',
    description: description || '',
    serviceLocation: {
      address: serviceLocation?.address || '',
      coordinates: {
        lat: parseFloat(userLat) || 30.9010,
        lng: parseFloat(userLng) || 75.8573,
      },
    },
    scheduledAt: scheduledAt || null,
    status: assignedWorker ? 'accepted' : 'searching',
    paymentMethod: paymentMethod || 'cash',
    arrivalOTP: { code: arrivalOTPCode, verified: false },
    statusHistory: [
      { status: 'requested', timestamp: new Date(), note: 'Booking created by user' },
      ...(assignedWorker
        ? [{ status: 'accepted', timestamp: new Date(), note: 'Worker auto-assigned' }]
        : [{ status: 'searching', timestamp: new Date(), note: 'Searching for available workers' }]),
    ],
    acceptedAt: assignedWorker ? new Date() : null,
    pricing: {
      baseRate: assignedWorker?.baseRate || 299,
    },
  });

  // Mark worker as busy
  if (assignedWorker) {
    await Worker.findByIdAndUpdate(assignedWorker._id, { isBusy: true });
  }

  // Notify worker via socket
  const io = req.app.get('io');
  if (io && assignedWorker?.socketId) {
    io.to(assignedWorker.socketId).emit('newBookingRequest', {
      bookingId: booking._id,
      user: { name: req.user.name, phone: req.user.phone },
      category,
      subCategory,
      description,
      serviceLocation: booking.serviceLocation,
      arrivalOTP: arrivalOTPCode,
    });
  }

  // Populate booking for response
  const populatedBooking = await Booking.findById(booking._id)
    .populate('user', 'name phone email')
    .populate('worker', 'name phone category rating location baseRate');

  res.status(201).json({
    success: true,
    message: assignedWorker
      ? `Worker found! ${assignedWorker.name} will be there shortly.`
      : 'Booking created. Searching for nearby workers...',
    booking: populatedBooking,
    workerFound: !!assignedWorker,
  });
});

// ─── GET /api/bookings ────────────────────────────────────────────────────
// Get bookings for logged-in user or worker
const getBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.role === 'user') filter.user = req.user._id;
  if (req.role === 'worker') filter.worker = req.user._id;
  if (status) filter.status = status;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('user', 'name phone email profilePic')
      .populate('worker', 'name phone category rating location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Booking.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    bookings,
  });
});

// ─── GET /api/bookings/:id ────────────────────────────────────────────────
const getBookingById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('user', 'name phone email profilePic location')
    .populate('worker', 'name phone category rating location baseRate verification');

  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  // Auth check: only the involved user or worker can view
  const isUser = req.role === 'user' && booking.user._id.toString() === req.user._id.toString();
  const isWorker = req.role === 'worker' && booking.worker?._id.toString() === req.user._id.toString();
  if (!isUser && !isWorker) {
    return res.status(403).json({ success: false, message: 'Not authorized to view this booking.' });
  }

  res.status(200).json({ success: true, booking });
});

// ─── PUT /api/bookings/:id/status ─────────────────────────────────────────
// Update booking status (worker updates mostly)
const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const validStatuses = ['accepted', 'on_the_way', 'arrived', 'in_progress', 'completed', 'cancelled', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  // Auth check
  const isUser = req.role === 'user' && booking.user.toString() === req.user._id.toString();
  const isWorker = req.role === 'worker' && booking.worker?.toString() === req.user._id.toString();
  if (!isUser && !isWorker) {
    return res.status(403).json({ success: false, message: 'Not authorized.' });
  }

  // Update booking
  booking.status = status;
  booking.statusHistory.push({ status, timestamp: new Date(), note: note || '' });

  // Set timestamps for key events
  if (status === 'accepted') booking.acceptedAt = new Date();
  if (status === 'in_progress') booking.startedAt = new Date();
  if (status === 'completed') {
    booking.completedAt = new Date();
    // Update worker stats
    await Worker.findByIdAndUpdate(booking.worker, {
      isBusy: false,
      $inc: { totalJobsCompleted: 1 },
    });
  }
  if (status === 'cancelled' || status === 'rejected') {
    booking.cancellation = {
      reason: note || '',
      cancelledBy: req.role,
      cancelledAt: new Date(),
    };
    // Free worker
    if (booking.worker) {
      await Worker.findByIdAndUpdate(booking.worker, { isBusy: false });
    }
  }

  await booking.save();

  // Emit real-time update
  const io = req.app.get('io');
  if (io) {
    io.emit(`bookingUpdate:${booking._id}`, { bookingId: booking._id, status, note });
  }

  const populated = await Booking.findById(booking._id)
    .populate('user', 'name phone')
    .populate('worker', 'name phone category rating');

  res.status(200).json({ success: true, message: `Booking status updated to "${status}".`, booking: populated });
});

// ─── POST /api/bookings/:id/accept (worker accepts a job) ─────────────────
const acceptBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (booking.status !== 'searching' && booking.status !== 'requested') {
    return res.status(400).json({ success: false, message: 'This booking is no longer available.' });
  }

  // Assign worker
  booking.worker = req.user._id;
  booking.status = 'accepted';
  booking.acceptedAt = new Date();
  booking.statusHistory.push({ status: 'accepted', timestamp: new Date(), note: 'Worker accepted the job' });
  booking.pricing.baseRate = req.user.baseRate;

  await booking.save();
  await Worker.findByIdAndUpdate(req.user._id, { isBusy: true });

  const io = req.app.get('io');
  if (io) {
    io.emit(`bookingUpdate:${booking._id}`, {
      bookingId: booking._id,
      status: 'accepted',
      worker: {
        _id: req.user._id,
        name: req.user.name,
        phone: req.user.phone,
        category: req.user.category,
        rating: req.user.rating,
      },
    });
  }

  res.status(200).json({ success: true, message: 'Job accepted!', booking });
});

// ─── POST /api/bookings/:id/review ───────────────────────────────────────
const reviewBooking = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (booking.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Only the user can review.' });
  }
  if (booking.status !== 'completed') {
    return res.status(400).json({ success: false, message: 'Can only review completed bookings.' });
  }
  if (booking.review.rating) {
    return res.status(400).json({ success: false, message: 'Already reviewed.' });
  }

  booking.review = { rating, comment: comment || '', reviewedAt: new Date() };
  await booking.save();

  // Update worker's average rating
  const workerBookings = await Booking.find({ worker: booking.worker, 'review.rating': { $exists: true, $ne: null } });
  const avgRating = workerBookings.reduce((sum, b) => sum + b.review.rating, 0) / workerBookings.length;

  await Worker.findByIdAndUpdate(booking.worker, {
    'rating.average': Math.round(avgRating * 10) / 10,
    'rating.count': workerBookings.length,
  });

  res.status(200).json({ success: true, message: 'Review submitted. Thank you!', booking });
});

// ─── POST /api/bookings/:id/cancel ────────────────────────────────────────
const cancelBooking = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (booking.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized.' });
  }

  const cancellableStatuses = ['requested', 'searching', 'accepted', 'on_the_way'];
  if (!cancellableStatuses.includes(booking.status)) {
    return res.status(400).json({ success: false, message: 'Cannot cancel booking at this stage.' });
  }

  booking.status = 'cancelled';
  booking.cancellation = { reason: reason || '', cancelledBy: 'user', cancelledAt: new Date() };
  booking.statusHistory.push({ status: 'cancelled', timestamp: new Date(), note: reason || 'Cancelled by user' });
  await booking.save();

  if (booking.worker) {
    await Worker.findByIdAndUpdate(booking.worker, { isBusy: false });

    const io = req.app.get('io');
    if (io) {
      io.emit(`bookingUpdate:${booking._id}`, { bookingId: booking._id, status: 'cancelled', reason });
    }
  }

  res.status(200).json({ success: true, message: 'Booking cancelled.', booking });
});

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  acceptBooking,
  reviewBooking,
  cancelBooking,
};
