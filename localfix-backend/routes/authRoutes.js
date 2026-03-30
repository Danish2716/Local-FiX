const express = require('express');
const router = express.Router();
const { protect, requireUser, requireWorker } = require('../middleware/auth');
const {
  userSignup,
  userLogin,
  getUserProfile,
  updateUserProfile,
  workerSignup,
  workerLogin,
  getWorkerProfile,
  updateWorkerProfile,
  toggleAvailability,
} = require('../controllers/authController');

// ─── User Auth ────────────────────────────────────────────
router.post('/user/signup', userSignup);
router.post('/user/login', userLogin);
router.get('/user/me', protect, requireUser, getUserProfile);
router.put('/user/profile', protect, requireUser, updateUserProfile);

// ─── Worker Auth ──────────────────────────────────────────
router.post('/worker/signup', workerSignup);
router.post('/worker/login', workerLogin);
router.get('/worker/me', protect, requireWorker, getWorkerProfile);
router.put('/worker/profile', protect, requireWorker, updateWorkerProfile);
router.put('/worker/availability', protect, requireWorker, toggleAvailability);

module.exports = router;
