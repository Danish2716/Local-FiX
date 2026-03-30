# 🔧 LocalFix Backend

Complete Node.js + Express + MongoDB backend for LocalFix — an Urban Company-style on-demand local services platform.

---

## 📁 Project Structure

```
localfix-backend/
├── server.js                  ← Main entry point
├── seed.js                    ← Test data seeder
├── localfix-api.js            ← Frontend integration script
├── package.json
├── .env.example               ← Copy this to .env
│
├── config/
│   ├── db.js                  ← MongoDB connection
│   └── mailer.js              ← Nodemailer / OTP email config
│
├── models/
│   ├── User.js                ← User schema
│   ├── Worker.js              ← Worker schema (with geo-index)
│   ├── Booking.js             ← Booking schema (full lifecycle)
│   └── OTP.js                 ← OTP schema with TTL (auto-expires in 5 min)
│
├── controllers/
│   ├── otpController.js       ← OTP send/verify logic
│   ├── authController.js      ← User + Worker signup/login
│   ├── workerController.js    ← Find workers, categories, location
│   └── bookingController.js   ← Create, update, cancel, review bookings
│
├── routes/
│   ├── otpRoutes.js
│   ├── authRoutes.js
│   ├── workerRoutes.js
│   └── bookingRoutes.js
│
├── middleware/
│   ├── auth.js                ← JWT verify + role-based access
│   └── errorHandler.js        ← Global error handler + asyncHandler
│
└── socket/
    └── socketHandler.js       ← Socket.io (chat, live tracking, booking updates)
```

---

## 🚀 Setup Instructions

### Step 1 — Prerequisites

Make sure you have these installed:
- **Node.js** v18 or higher → https://nodejs.org
- **MongoDB** (local) → https://www.mongodb.com/try/download/community
  OR use **MongoDB Atlas** (free cloud) → https://cloud.mongodb.com

### Step 2 — Install Dependencies

```bash
cd localfix-backend
npm install
```

### Step 3 — Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
PORT=5000
NODE_ENV=development

# MongoDB (local)
MONGO_URI=mongodb://localhost:27017/localfix

# OR MongoDB Atlas
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/localfix

JWT_SECRET=your_super_secret_key_here_make_it_long

# Gmail OTP (Generate App Password from Google Account settings)
EMAIL_SERVICE=gmail
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-16-char-app-password
```

#### ✉️ Gmail App Password Setup (for OTP emails):
1. Go to your Google Account → Security
2. Enable **2-Step Verification**
3. Go to **App Passwords** → Select "Mail" → "Other (Custom name)"
4. Name it "LocalFix" → Click Generate
5. Copy the 16-character password → paste in `EMAIL_PASS`

### Step 4 — Seed Test Data

```bash
node seed.js
```

This creates:
- 1 test user: `danish@test.com` / `test1234`
- 10 test workers: `worker1@test.com` ... `worker10@test.com` / `worker1234`
- 1 completed sample booking

### Step 5 — Start Server

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

Server runs at: **http://localhost:5000**

---

## 🔌 Frontend Integration

### Step 1 — Add the script to your HTML

Open `localfix_v2.html` and add this just before `</body>`:

```html
<script src="localfix-api.js"></script>
```

Make sure `localfix-api.js` is in the same folder as your HTML file.

### Step 2 — Wire up your buttons

Replace your existing button `onclick` attributes with API calls. Examples:

**User Login button:**
```html
<!-- Before -->
<button class="btn-primary" onclick="goTo('dashboard')">Login</button>

<!-- After -->
<button class="btn-primary" id="login-submit-btn" onclick="LFUser.login(this)">Login</button>
```

**Add IDs to your input fields:**
```html
<input type="email" id="login-email" placeholder="Email" />
<input type="password" id="login-password" placeholder="Password" />
```

**Send OTP button:**
```html
<button onclick="LFOtp.send(document.getElementById('signup-email').value, 'user_signup', document.getElementById('signup-name').value, this)">
  Send OTP
</button>
```

**User Signup button:**
```html
<button class="btn-primary" onclick="LFUser.signup(this)">Create Account</button>
```
Required input IDs: `signup-name`, `signup-email`, `signup-phone`, `signup-password`, `signup-otp`

**Worker Signup button:**
```html
<button class="btn-primary" onclick="LFWorker.signup(this)">Register as Worker</button>
```
Required input IDs: `ws-name`, `ws-email`, `ws-phone`, `ws-aadhar`, `ws-password`, `ws-otp`, `ws-category`

**Book a service:**
```html
<button class="btn-primary" onclick="LFBooking.createBooking('electrician', 'Fan Repair', null, this)">
  Book Now
</button>
```

**Logout:**
```html
<div onclick="LFUser.logout()">Logout</div>
```

---

## 📡 API Reference

### Base URL: `http://localhost:5000/api`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | No | Health check |
| `POST` | `/otp/send` | No | Send OTP to email |
| `POST` | `/otp/verify` | No | Verify OTP |
| `POST` | `/auth/user/signup` | No | User registration |
| `POST` | `/auth/user/login` | No | User login |
| `GET` | `/auth/user/me` | User | Get user profile |
| `PUT` | `/auth/user/profile` | User | Update user profile |
| `POST` | `/auth/worker/signup` | No | Worker registration |
| `POST` | `/auth/worker/login` | No | Worker login |
| `GET` | `/auth/worker/me` | Worker | Get worker profile |
| `PUT` | `/auth/worker/profile` | Worker | Update worker profile |
| `PUT` | `/auth/worker/availability` | Worker | Toggle online/offline |
| `GET` | `/workers` | No | List available workers |
| `GET` | `/workers?category=electrician` | No | Filter by category |
| `GET` | `/workers/categories` | No | Get all categories with counts |
| `GET` | `/workers/:id` | No | Get worker by ID |
| `PUT` | `/workers/location` | Worker | Update worker GPS location |
| `POST` | `/bookings` | User | Create new booking |
| `GET` | `/bookings` | User/Worker | Get my bookings |
| `GET` | `/bookings/:id` | User/Worker | Get booking details |
| `PUT` | `/bookings/:id/status` | User/Worker | Update booking status |
| `POST` | `/bookings/:id/accept` | Worker | Worker accepts job |
| `POST` | `/bookings/:id/review` | User | Submit review after completion |
| `POST` | `/bookings/:id/cancel` | User | Cancel booking |

### Auth Header (for protected routes):
```
Authorization: Bearer <your_jwt_token>
```

---

## 🔌 Socket.io Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `authenticate` | `{ token }` | Authenticate socket with JWT |
| `joinBookingRoom` | `{ bookingId }` | Join a booking-specific room |
| `leaveBookingRoom` | `{ bookingId }` | Leave a booking room |
| `updateLocation` | `{ lat, lng, bookingId }` | Worker sends GPS update |
| `sendMessage` | `{ bookingId, message, senderRole }` | Send chat message |
| `toggleAvailability` | `{ isOnline }` | Worker toggles online status |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ role, id }` | Socket authenticated |
| `newBookingRequest` | booking data | Sent to worker on new job |
| `bookingUpdate:{id}` | `{ status, ... }` | Booking status changed |
| `workerLocationUpdate` | `{ workerId, lat, lng }` | Live worker location |
| `chatMessage` | `{ message, senderRole, timestamp }` | Incoming chat message |
| `workerAvailabilityChanged` | `{ workerId, isOnline }` | Worker toggled availability |

---

## 🔒 Security Features

- **Password hashing** — bcryptjs with salt rounds 12
- **JWT authentication** — 7-day expiry, role-based
- **OTP expiry** — MongoDB TTL index auto-deletes after 5 minutes
- **Max OTP attempts** — 5 wrong attempts invalidates the OTP
- **Duplicate email check** — 409 conflict response
- **Role-based access** — user vs worker endpoints protected separately
- **Input validation** — all required fields checked
- **Error handling** — centralized, no stack traces in production

---

## 🧪 Test with curl

```bash
# Health check
curl http://localhost:5000/health

# Send OTP (use dev mode to see OTP in response)
curl -X POST http://localhost:5000/api/otp/send \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","purpose":"user_signup","name":"Test User"}'

# User login
curl -X POST http://localhost:5000/api/auth/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"danish@test.com","password":"test1234"}'

# Get workers (no auth needed)
curl http://localhost:5000/api/workers?category=electrician
```

---

## 🐛 Troubleshooting

| Problem | Fix |
|---------|-----|
| `MongoDB connection failed` | Make sure MongoDB is running: `mongod` |
| `OTP email not sending` | Check `.env` EMAIL_USER and EMAIL_PASS; use Gmail App Password |
| `JWT invalid` | Token expired or wrong JWT_SECRET — re-login |
| `CORS error in browser` | Set `FRONTEND_URL` in `.env` to match your frontend origin |
| `Worker not found nearby` | Run `node seed.js` to add test workers |
| `Socket not connecting` | Make sure backend is running and SOCKET_URL matches in `localfix-api.js` |

---

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v18+ |
| Framework | Express.js 4.x |
| Database | MongoDB + Mongoose 8 |
| Auth | JWT + bcryptjs |
| OTP Email | Nodemailer |
| Real-time | Socket.io 4.x |
| Validation | express-validator |
| Logging | Morgan |
