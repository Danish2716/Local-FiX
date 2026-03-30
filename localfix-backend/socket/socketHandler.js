const jwt = require('jsonwebtoken');
const Worker = require('../models/Worker');
const Booking = require('../models/Booking');

/**
 * LocalFix Socket.io Handler
 *
 * Events emitted BY server:
 *   - newBookingRequest        → sent to worker when user books
 *   - bookingUpdate:{id}       → sent to all when booking status changes
 *   - workerLocationUpdate     → sent to user tracking a worker
 *   - workerAvailabilityChanged → broadcast when worker toggles online
 *   - chatMessage              → relayed message in a booking chat
 *   - connected                → sent on successful socket auth
 *
 * Events listened FROM client:
 *   - authenticate             → client sends JWT to link socket with user/worker
 *   - updateLocation           → worker sends GPS coordinates
 *   - sendMessage              → chat message
 *   - joinBookingRoom          → user/worker joins a booking-specific room
 *   - leaveBookingRoom         → leave a booking room
 *   - disconnect               → handled automatically
 */
const initSocket = (io) => {
  // Socket auth middleware — client must authenticate after connect
  io.use(async (socket, next) => {
    // Allow unauthenticated sockets (auth happens via 'authenticate' event)
    next();
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── Authenticate socket with JWT ──────────────────────────
    socket.on('authenticate', async ({ token }) => {
      try {
        if (!token) {
          socket.emit('authError', { message: 'No token provided.' });
          return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role === 'worker') {
          // Save socket ID to worker record for targeted messaging
          await Worker.findByIdAndUpdate(decoded.id, { socketId: socket.id });
          socket.workerId = decoded.id;
          socket.role = 'worker';
          socket.join(`worker:${decoded.id}`);
          console.log(`✅ Worker authenticated: ${decoded.id}`);
        } else {
          socket.userId = decoded.id;
          socket.role = 'user';
          socket.join(`user:${decoded.id}`);
          console.log(`✅ User authenticated: ${decoded.id}`);
        }

        socket.emit('connected', {
          message: 'Socket authenticated.',
          role: decoded.role,
          id: decoded.id,
        });
      } catch (err) {
        console.error('Socket auth error:', err.message);
        socket.emit('authError', { message: 'Invalid or expired token.' });
      }
    });

    // ── Join a booking-specific room ──────────────────────────
    socket.on('joinBookingRoom', async ({ bookingId }) => {
      try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          socket.emit('error', { message: 'Booking not found.' });
          return;
        }
        socket.join(`booking:${bookingId}`);
        console.log(`📌 Socket ${socket.id} joined booking room: ${bookingId}`);
        socket.emit('joinedBookingRoom', { bookingId });
      } catch (err) {
        socket.emit('error', { message: 'Could not join booking room.' });
      }
    });

    // ── Leave a booking room ──────────────────────────────────
    socket.on('leaveBookingRoom', ({ bookingId }) => {
      socket.leave(`booking:${bookingId}`);
      console.log(`🚪 Socket ${socket.id} left booking room: ${bookingId}`);
    });

    // ── Worker sends live location update ─────────────────────
    socket.on('updateLocation', async ({ lat, lng, bookingId }) => {
      try {
        if (!socket.workerId) return;

        // Update DB
        await Worker.findByIdAndUpdate(socket.workerId, {
          'location.coordinates': [parseFloat(lng), parseFloat(lat)],
        });

        // Broadcast to booking room
        const payload = {
          workerId: socket.workerId,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          timestamp: new Date(),
        };

        if (bookingId) {
          io.to(`booking:${bookingId}`).emit('workerLocationUpdate', payload);
        } else {
          io.emit('workerLocationUpdate', payload);
        }
      } catch (err) {
        console.error('Location update error:', err.message);
      }
    });

    // ── Chat message ──────────────────────────────────────────
    socket.on('sendMessage', async ({ bookingId, message, senderRole }) => {
      try {
        if (!bookingId || !message) return;

        const payload = {
          bookingId,
          message: message.trim(),
          senderRole: senderRole || socket.role,
          senderId: socket.workerId || socket.userId,
          timestamp: new Date(),
        };

        // Relay to everyone in the booking room (including sender)
        io.to(`booking:${bookingId}`).emit('chatMessage', payload);
      } catch (err) {
        console.error('Chat message error:', err.message);
      }
    });

    // ── Worker toggles availability ───────────────────────────
    socket.on('toggleAvailability', async ({ isOnline }) => {
      try {
        if (!socket.workerId) return;
        await Worker.findByIdAndUpdate(socket.workerId, { isOnline });
        io.emit('workerAvailabilityChanged', { workerId: socket.workerId, isOnline });
        console.log(`Worker ${socket.workerId} is now ${isOnline ? 'online' : 'offline'}`);
      } catch (err) {
        console.error('Availability toggle error:', err.message);
      }
    });

    // ── Disconnect ────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);

      // Clear socketId from worker record
      if (socket.workerId) {
        await Worker.findByIdAndUpdate(socket.workerId, { socketId: null }).catch(() => {});
      }
    });
  });

  console.log('🚀 Socket.io initialized');
};

module.exports = initSocket;
