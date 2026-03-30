// ============================================================
// LocalFix Backend - Main Server
// ============================================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const initSocket = require('./socket/socketHandler');

// Routes
const otpRoutes = require('./routes/otpRoutes');
const authRoutes = require('./routes/authRoutes');
const workerRoutes = require('./routes/workerRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

// ─── Connect to MongoDB ───────────────────────────────────────────────────
connectDB();

// ─── Express App ──────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Socket.io Setup ──────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible in route handlers via req.app.get('io')
app.set('io', io);
initSocket(io);

// ─── Middleware ───────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ─── Health Check ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🔧 LocalFix API is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────
app.use('/api/otp', otpRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/bookings', bookingRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('');
  console.log('  🔧 ─────────────────────────────────────────');
  console.log('     LocalFix Backend Server');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  ✅  Server running on http://localhost:${PORT}`);
  console.log(`  🌍  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  🔌  Socket.io ready`);
  console.log('  ─────────────────────────────────────────────');
  console.log('');
});

module.exports = { app, server };
