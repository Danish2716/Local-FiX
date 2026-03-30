const express = require('express');
const router = express.Router();
const { protect, requireUser, requireWorker } = require('../middleware/auth');
const {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  acceptBooking,
  reviewBooking,
  cancelBooking,
} = require('../controllers/bookingController');

// POST /api/bookings  (user creates booking)
router.post('/', protect, requireUser, createBooking);

// GET /api/bookings  (user or worker gets their bookings)
router.get('/', protect, getBookings);

// GET /api/bookings/:id
router.get('/:id', protect, getBookingById);

// PUT /api/bookings/:id/status  (worker updates status)
router.put('/:id/status', protect, updateBookingStatus);

// POST /api/bookings/:id/accept  (worker accepts a searching job)
router.post('/:id/accept', protect, requireWorker, acceptBooking);

// POST /api/bookings/:id/review  (user reviews after completion)
router.post('/:id/review', protect, requireUser, reviewBooking);

// POST /api/bookings/:id/cancel  (user cancels booking)
router.post('/:id/cancel', protect, requireUser, cancelBooking);

module.exports = router;
