/**
 * ============================================================
 * LocalFix Frontend ↔ Backend Integration
 * localfix-api.js
 *
 * HOW TO USE:
 *   1. Host this file alongside your localfix_v2.html
 *   2. Add this in your HTML <head> BEFORE the closing </body>:
 *      <script src="localfix-api.js"></script>
 *   3. Change BASE_URL to your backend server address.
 *
 * This file:
 *   - Manages JWT token (localStorage)
 *   - Wraps all API calls (fetch)
 *   - Hooks into existing frontend form buttons
 *   - Handles Socket.io for real-time features
 * ============================================================
 */

// ─── CONFIG ───────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:5000/api'; // Change this to your backend URL
const SOCKET_URL = 'http://localhost:5000';   // Change this to your backend URL

// ─── STATE ────────────────────────────────────────────────────────────────
const LFState = {
  token: localStorage.getItem('lf_token') || null,
  user: JSON.parse(localStorage.getItem('lf_user') || 'null'),
  role: localStorage.getItem('lf_role') || null,
  currentBookingId: null,
  socket: null,
};

// ─── TOKEN HELPERS ────────────────────────────────────────────────────────
const LFAuth = {
  save(token, userOrWorker, role) {
    LFState.token = token;
    LFState.user = userOrWorker;
    LFState.role = role;
    localStorage.setItem('lf_token', token);
    localStorage.setItem('lf_user', JSON.stringify(userOrWorker));
    localStorage.setItem('lf_role', role);
  },
  clear() {
    LFState.token = null;
    LFState.user = null;
    LFState.role = null;
    LFState.currentBookingId = null;
    localStorage.removeItem('lf_token');
    localStorage.removeItem('lf_user');
    localStorage.removeItem('lf_role');
  },
  isLoggedIn() {
    return !!LFState.token;
  },
};

// ─── API HELPER ───────────────────────────────────────────────────────────
const LFAPI = {
  async request(method, endpoint, body = null, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && LFState.token) {
      headers['Authorization'] = `Bearer ${LFState.token}`;
    }

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }
    return data;
  },
  get: (endpoint, auth = true) => LFAPI.request('GET', endpoint, null, auth),
  post: (endpoint, body, auth = false) => LFAPI.request('POST', endpoint, body, auth),
  put: (endpoint, body, auth = true) => LFAPI.request('PUT', endpoint, body, auth),
};

// ─── UI HELPERS ───────────────────────────────────────────────────────────
// showToast is already defined in your HTML — we reuse it

const LFShowLoading = (buttonEl, loadingText = 'Please wait...') => {
  if (!buttonEl) return;
  buttonEl._originalText = buttonEl.textContent;
  buttonEl.disabled = true;
  buttonEl.textContent = loadingText;
  buttonEl.style.opacity = '0.7';
};

const LFHideLoading = (buttonEl) => {
  if (!buttonEl) return;
  buttonEl.disabled = false;
  buttonEl.textContent = buttonEl._originalText || 'Submit';
  buttonEl.style.opacity = '1';
};

// ─── SOCKET.IO ───────────────────────────────────────────────────────────
const LFSocket = {
  connect() {
    if (LFState.socket) return;
    // Dynamically load socket.io client
    const script = document.createElement('script');
    script.src = `${SOCKET_URL}/socket.io/socket.io.js`;
    script.onload = () => {
      LFState.socket = io(SOCKET_URL);

      LFState.socket.on('connect', () => {
        console.log('🔌 Socket connected');
        // Authenticate socket if logged in
        if (LFState.token) {
          LFState.socket.emit('authenticate', { token: LFState.token });
        }
      });

      LFState.socket.on('connected', (data) => {
        console.log('✅ Socket authenticated as:', data.role);
      });

      // Listen for booking status updates
      if (LFState.currentBookingId) {
        LFSocket.joinBookingRoom(LFState.currentBookingId);
      }

      LFState.socket.on('bookingUpdate', (data) => {
        console.log('📦 Booking update:', data);
        LFSocket.handleBookingUpdate(data);
      });

      LFState.socket.on('workerLocationUpdate', (data) => {
        console.log('📍 Worker location update:', data);
        // You can update a map marker here
      });

      LFState.socket.on('chatMessage', (data) => {
        LFSocket.handleIncomingMessage(data);
      });

      LFState.socket.on('newBookingRequest', (data) => {
        // For workers: show incoming job
        if (LFState.role === 'worker') {
          LFWorker.showIncomingJob(data);
        }
      });
    };
    document.head.appendChild(script);
  },

  joinBookingRoom(bookingId) {
    if (!LFState.socket) return;
    LFState.socket.emit('joinBookingRoom', { bookingId });
    // Also listen on booking-specific channel
    LFState.socket.on(`bookingUpdate:${bookingId}`, (data) => {
      LFSocket.handleBookingUpdate(data);
    });
  },

  handleBookingUpdate(data) {
    const { status } = data;
    const statusMessages = {
      accepted: '✅ Worker accepted your job!',
      on_the_way: '🚗 Worker is on the way!',
      arrived: '📍 Worker has arrived!',
      in_progress: '🔧 Work in progress...',
      completed: '✅ Job completed!',
      cancelled: '❌ Booking was cancelled.',
      rejected: '❌ No workers available right now.',
    };

    if (statusMessages[status] && typeof showToast === 'function') {
      showToast(statusMessages[status]);
    }

    // Navigate to worker-found screen on accept
    if (status === 'accepted' && typeof goTo === 'function') {
      goTo('worker-found');
    }
    if (status === 'completed' && typeof goTo === 'function') {
      goTo('booking-review');
    }
  },

  handleIncomingMessage(data) {
    const chatBody = document.querySelector('#chat-screen .chat-body');
    if (!chatBody) return;

    const isOutgoing = data.senderId === LFState.user?._id;
    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg ${isOutgoing ? 'out' : 'in'}`;
    msgEl.innerHTML = `
      ${data.message}
      <div class="chat-time">${new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    chatBody.appendChild(msgEl);
    chatBody.scrollTop = chatBody.scrollHeight;
  },

  sendMessage(bookingId, message) {
    if (!LFState.socket || !message.trim()) return;
    LFState.socket.emit('sendMessage', {
      bookingId,
      message: message.trim(),
      senderRole: LFState.role,
    });
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OTP FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LFOtp = {
  // Call this when user clicks "Send OTP" button
  async send(email, purpose, name, buttonEl) {
    if (!email) return showToast('⚠️ Please enter your email first.');

    LFShowLoading(buttonEl, 'Sending OTP...');
    try {
      const data = await LFAPI.post('/otp/send', { email, purpose, name });
      showToast(`📧 OTP sent to ${email}`);
      return true;
    } catch (err) {
      showToast(`❌ ${err.message}`);
      return false;
    } finally {
      LFHideLoading(buttonEl);
    }
  },

  // Call this when user clicks "Verify OTP" button
  async verify(email, otp, purpose, buttonEl) {
    if (!otp || otp.length !== 6) return showToast('⚠️ Please enter a 6-digit OTP.');

    LFShowLoading(buttonEl, 'Verifying...');
    try {
      const data = await LFAPI.post('/otp/verify', { email, otp, purpose });
      showToast('✅ OTP verified!');
      return true;
    } catch (err) {
      showToast(`❌ ${err.message}`);
      return false;
    } finally {
      LFHideLoading(buttonEl);
    }
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER AUTH FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LFUser = {
  async signup(buttonEl) {
    const name = document.getElementById('signup-name')?.value?.trim();
    const email = document.getElementById('signup-email')?.value?.trim();
    const phone = document.getElementById('signup-phone')?.value?.trim();
    const password = document.getElementById('signup-password')?.value;
    const otp = document.getElementById('signup-otp')?.value?.trim();

    if (!name || !email || !phone || !password || !otp) {
      return showToast('⚠️ Please fill all fields including OTP.');
    }

    LFShowLoading(buttonEl, 'Creating Account...');
    try {
      const data = await LFAPI.post('/auth/user/signup', { name, email, phone, password, otp });
      LFAuth.save(data.token, data.user, 'user');
      LFUser.updateDashboard(data.user);
      showToast(`🎉 Welcome, ${data.user.name}!`);
      LFSocket.connect();
      goTo('dashboard');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      LFHideLoading(buttonEl);
    }
  },

  async login(buttonEl) {
    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;

    if (!email || !password) {
      return showToast('⚠️ Please enter email and password.');
    }

    LFShowLoading(buttonEl, 'Logging in...');
    try {
      const data = await LFAPI.post('/auth/user/login', { email, password });
      LFAuth.save(data.token, data.user, 'user');
      LFUser.updateDashboard(data.user);
      showToast(`👋 Welcome back, ${data.user.name}!`);
      LFSocket.connect();
      goTo('dashboard');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      LFHideLoading(buttonEl);
    }
  },

  updateDashboard(user) {
    // Update greeting
    const greetEl = document.getElementById('dash-greeting');
    if (greetEl) greetEl.textContent = `Hi, ${user.name.split(' ')[0]} 👋`;

    // Update avatar initials
    const avatarEl = document.querySelector('.avatar-btn');
    if (avatarEl) {
      const initials = user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
      avatarEl.textContent = initials;
    }

    // Update profile screen
    const profileName = document.getElementById('profile-name');
    if (profileName) profileName.textContent = user.name;

    const profileEmail = document.getElementById('profile-email');
    if (profileEmail) profileEmail.textContent = user.email;
  },

  logout() {
    LFAuth.clear();
    if (LFState.socket) {
      LFState.socket.disconnect();
      LFState.socket = null;
    }
    showToast('👋 Logged out successfully.');
    goTo('splash', 'left');
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WORKER AUTH FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LFWorker = {
  async signup(buttonEl) {
    const name = document.getElementById('ws-name')?.value?.trim();
    const email = document.getElementById('ws-email')?.value?.trim();
    const phone = document.getElementById('ws-phone')?.value?.trim();
    const aadharNumber = document.getElementById('ws-aadhar')?.value?.trim();
    const password = document.getElementById('ws-password')?.value;
    const otp = document.getElementById('ws-otp')?.value?.trim();

    // Get selected category
    const categoryEl = document.getElementById('ws-category');
    const category = categoryEl?.value;

    // Get selected sub-skills
    const selectedChips = document.querySelectorAll('#ws-skills-grid .skill-chip.selected');
    const subSkills = Array.from(selectedChips).map((c) => c.textContent.trim());

    if (!name || !email || !phone || !aadharNumber || !password || !otp || !category) {
      return showToast('⚠️ Please fill all required fields including OTP.');
    }

    LFShowLoading(buttonEl, 'Registering...');
    try {
      const data = await LFAPI.post('/auth/worker/signup', {
        name, email, phone, aadharNumber, password, otp, category, subSkills,
      });
      LFAuth.save(data.token, data.worker, 'worker');
      showToast(`🎉 Welcome to LocalFix, ${data.worker.name}!`);
      LFSocket.connect();
      goTo('worker-dashboard');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      LFHideLoading(buttonEl);
    }
  },

  async login(buttonEl) {
    const email = document.getElementById('wl-email')?.value?.trim();
    const password = document.getElementById('wl-password')?.value;

    if (!email || !password) {
      return showToast('⚠️ Please enter email and password.');
    }

    LFShowLoading(buttonEl, 'Logging in...');
    try {
      const data = await LFAPI.post('/auth/worker/login', { email, password });
      LFAuth.save(data.token, data.worker, 'worker');
      showToast(`👋 Welcome back, ${data.worker.name}!`);
      LFSocket.connect();
      goTo('worker-dashboard');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      LFHideLoading(buttonEl);
    }
  },

  async toggleAvailability(isOnline, buttonEl) {
    try {
      await LFAPI.put('/auth/worker/availability', { isOnline });
      if (LFState.socket) {
        LFState.socket.emit('toggleAvailability', { isOnline });
      }
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  },

  showIncomingJob(jobData) {
    // Update the job card in the worker dashboard
    const jobCard = document.getElementById('wd-job-category');
    if (jobCard) jobCard.textContent = jobData.category;

    const jobDesc = document.getElementById('wd-job-desc');
    if (jobDesc) jobDesc.textContent = jobData.description || 'New job request';

    showToast('🔔 New job request!');
    goTo('worker-new-job-screen');
  },

  async acceptJob(bookingId, buttonEl) {
    LFShowLoading(buttonEl, 'Accepting...');
    try {
      await LFAPI.post(`/bookings/${bookingId}/accept`, {}, true);
      showToast('✅ Job accepted!');
      goTo('worker-job-screen');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      LFHideLoading(buttonEl);
    }
  },

  async updateJobStatus(bookingId, status, note, buttonEl) {
    LFShowLoading(buttonEl, 'Updating...');
    try {
      await LFAPI.put(`/bookings/${bookingId}/status`, { status, note }, true);
      const messages = {
        on_the_way: '🚗 Status updated: On the way!',
        arrived: '📍 Status updated: Arrived!',
        in_progress: '🔧 Job started!',
        completed: '✅ Job marked as complete!',
      };
      showToast(messages[status] || '✅ Status updated!');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      LFHideLoading(buttonEl);
    }
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOOKING FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LFBooking = {
  async createBooking(category, subCategory, workerId, buttonEl) {
    if (!LFAuth.isLoggedIn()) {
      showToast('⚠️ Please login first.');
      goTo('login');
      return;
    }

    LFShowLoading(buttonEl, 'Finding workers...');
    try {
      const body = {
        category,
        subCategory: subCategory || '',
        workerId: workerId || null,
        serviceLocation: {
          address: LFState.user?.location?.address || '',
          coordinates: {
            lat: LFState.user?.location?.coordinates?.lat || 30.9010,
            lng: LFState.user?.location?.coordinates?.lng || 75.8573,
          },
        },
      };

      const data = await LFAPI.post('/bookings', body, true);
      LFState.currentBookingId = data.booking._id;
      localStorage.setItem('lf_booking_id', data.booking._id);

      // Join real-time room for this booking
      LFSocket.joinBookingRoom(data.booking._id);

      showToast(data.message);

      if (data.workerFound) {
        LFBooking.populateWorkerFound(data.booking);
        goTo('worker-found');
      } else {
        goTo('searching-screen');
      }

      return data;
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      LFHideLoading(buttonEl);
    }
  },

  populateWorkerFound(booking) {
    const worker = booking.worker;
    if (!worker) return;

    const nameEl = document.querySelector('.wf-card .wf-worker-name');
    if (nameEl) nameEl.textContent = worker.name;

    const skillEl = document.querySelector('.wf-card .wf-worker-skill');
    if (skillEl) skillEl.textContent = worker.category?.replace('_', ' ');

    const ratingEl = document.querySelector('.wf-card .wf-worker-rating');
    if (ratingEl) ratingEl.textContent = `⭐ ${worker.rating?.average || 'New'}`;
  },

  async loadMyBookings() {
    try {
      const data = await LFAPI.get('/bookings');
      return data.bookings;
    } catch (err) {
      console.error('Load bookings error:', err.message);
      return [];
    }
  },

  async cancelBooking(bookingId, reason, buttonEl) {
    LFShowLoading(buttonEl, 'Cancelling...');
    try {
      await LFAPI.post(`/bookings/${bookingId}/cancel`, { reason }, true);
      showToast('Booking cancelled.');
      goTo('dashboard', 'left');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      LFHideLoading(buttonEl);
    }
  },

  async submitReview(bookingId, rating, comment, buttonEl) {
    LFShowLoading(buttonEl, 'Submitting...');
    try {
      await LFAPI.post(`/bookings/${bookingId}/review`, { rating, comment }, true);
      showToast('⭐ Review submitted! Thank you.');
      goTo('dashboard', 'left');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      LFHideLoading(buttonEl);
    }
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WORKERS LIST FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LFWorkerList = {
  async loadNearbyWorkers(category) {
    try {
      const lat = LFState.user?.location?.coordinates?.lat || '';
      const lng = LFState.user?.location?.coordinates?.lng || '';
      const query = `?category=${category}&lat=${lat}&lng=${lng}`;
      const data = await LFAPI.get(`/workers${query}`, false);
      return data.workers;
    } catch (err) {
      console.error('Load workers error:', err.message);
      return [];
    }
  },

  renderWorkerCard(worker) {
    const initials = worker.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    return `
      <div class="nearby-worker-row" onclick="LFBooking.createBooking('${worker.category}', '', '${worker._id}', this.querySelector('.nw-book'))">
        <div class="nw-avatar">${initials}</div>
        <div class="nw-info">
          <div class="nw-name">${worker.name}</div>
          <div class="nw-skill">${worker.category?.replace('_', ' ')}</div>
          <div class="nw-meta">
            <span class="nw-dist">${worker.distance || '~2'} km away</span>
            <span class="nw-rating">⭐ ${worker.rating?.average || 'New'}</span>
          </div>
        </div>
        <button class="nw-book">Book</button>
      </div>
    `;
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHAT FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LFChat = {
  send(inputEl, buttonEl) {
    const message = inputEl?.value?.trim();
    if (!message) return;
    if (!LFState.currentBookingId) {
      showToast('⚠️ No active booking found.');
      return;
    }
    LFSocket.sendMessage(LFState.currentBookingId, message);
    inputEl.value = '';
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTO-INIT ON PAGE LOAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

window.addEventListener('DOMContentLoaded', () => {
  console.log('🔧 LocalFix API integration loaded');

  // If already logged in, restore UI and connect socket
  if (LFAuth.isLoggedIn() && LFState.user) {
    if (LFState.role === 'user') LFUser.updateDashboard(LFState.user);
    LFSocket.connect();
  }

  // Restore current booking if any
  const savedBookingId = localStorage.getItem('lf_booking_id');
  if (savedBookingId) LFState.currentBookingId = savedBookingId;

  // Hook up the chat send button if it exists
  const chatSendBtn = document.querySelector('.chat-send');
  const chatInput = document.querySelector('.chat-input');
  if (chatSendBtn && chatInput) {
    chatSendBtn.addEventListener('click', () => LFChat.send(chatInput, chatSendBtn));
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') LFChat.send(chatInput, chatSendBtn);
    });
  }
});

// ─── Expose globals for use in HTML onclick attributes ────────────────────
window.LFOtp = LFOtp;
window.LFUser = LFUser;
window.LFWorker = LFWorker;
window.LFBooking = LFBooking;
window.LFWorkerList = LFWorkerList;
window.LFChat = LFChat;
window.LFAuth = LFAuth;
