const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP } = require('../controllers/otpController');

// POST /api/otp/send
router.post('/send', sendOTP);

// POST /api/otp/verify
router.post('/verify', verifyOTP);

module.exports = router;
