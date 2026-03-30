/**
 * LocalFix Seed Script
 * Run: node seed.js
 * This creates test users, workers, and bookings in MongoDB.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Worker = require('./models/Worker');
const Booking = require('./models/Booking');

const connectDB = require('./config/db');

const CATEGORIES = ['electrician', 'plumber', 'ac_technician', 'carpenter', 'mechanic', 'cleaning'];

const WORKER_NAMES = [
  'Rajesh Kumar', 'Sunil Sharma', 'Pradeep Verma', 'Manoj Singh',
  'Harpreet Kaur', 'Vikram Patel', 'Deepak Gupta', 'Amit Yadav',
  'Ravi Shankar', 'Sanjay Mehta',
];

const SUB_SKILLS = {
  electrician: ['Wiring', 'Switchboard', 'Fan Installation', 'Short Circuit', 'MCB'],
  plumber: ['Pipe Fitting', 'Tap Repair', 'Drain Cleaning', 'Motor Pump', 'Bathroom Fitting'],
  ac_technician: ['Split AC', 'Window AC', 'Fridge', 'Washing Machine', 'Service'],
  carpenter: ['Door Fix', 'Furniture Assembly', 'Wardrobe', 'Polishing', 'Wood Work'],
  mechanic: ['Bike Repair', 'Car Repair', 'Oil Change', 'Puncture', 'Battery'],
  cleaning: ['Deep Clean', 'Bathroom Clean', 'Sofa Clean', 'Kitchen Clean', 'Floor Polish'],
};

const seed = async () => {
  await connectDB();

  try {
    console.log('🌱 Starting seed...');

    // Clear existing
    await Promise.all([
      User.deleteMany({}),
      Worker.deleteMany({}),
      Booking.deleteMany({}),
    ]);
    console.log('🗑️  Cleared existing data');

    // ── Create test user ──────────────────────────────────────
    const user = await User.create({
      name: 'Danish Raza',
      email: 'danish@test.com',
      phone: '9876543210',
      password: 'test1234',
      isEmailVerified: true,
      location: {
        city: 'Ludhiana',
        address: 'LPU Campus, Phagwara',
        coordinates: { lat: 31.2530, lng: 75.7051 },
      },
    });
    console.log(`✅ Test user created: danish@test.com / test1234`);

    // ── Create workers ────────────────────────────────────────
    const workerDocs = WORKER_NAMES.map((name, i) => {
      const category = CATEGORIES[i % CATEGORIES.length];
      const skills = SUB_SKILLS[category];

      // Scatter around Ludhiana (30.9010, 75.8573)
      const lat = 30.9010 + (Math.random() - 0.5) * 0.1;
      const lng = 75.8573 + (Math.random() - 0.5) * 0.1;

      return {
        name,
        email: `worker${i + 1}@test.com`,
        phone: `98765432${String(i).padStart(2, '0')}`,
        password: 'worker1234',
        aadharNumber: `1234 5678 ${String(9000 + i)}`,
        category,
        subSkills: skills.slice(0, 3),
        baseRate: 200 + (i * 50),
        isOnline: i % 3 !== 0, // 2/3 are online
        isBusy: false,
        isEmailVerified: true,
        experience: 1 + (i % 8),
        location: {
          type: 'Point',
          coordinates: [lng, lat],
          city: 'Ludhiana',
          serviceRadius: 5,
        },
        rating: {
          average: parseFloat((3.5 + Math.random() * 1.5).toFixed(1)),
          count: Math.floor(10 + Math.random() * 90),
        },
        totalJobsCompleted: Math.floor(20 + Math.random() * 200),
        verification: { aadhar: i % 2 === 0, certificate: i % 3 === 0 },
      };
    });

    const workers = await Worker.insertMany(workerDocs);
    console.log(`✅ ${workers.length} workers created (worker1@test.com ... / worker1234)`);

    // ── Create a sample completed booking ─────────────────────
    await Booking.create({
      user: user._id,
      worker: workers[0]._id,
      category: workers[0].category,
      subCategory: 'Wiring',
      description: 'Fan not working, need electrician',
      serviceLocation: {
        address: 'LPU Campus, Phagwara',
        coordinates: { lat: 31.2530, lng: 75.7051 },
      },
      status: 'completed',
      pricing: { baseRate: workers[0].baseRate, hours: 2, total: workers[0].baseRate * 2 },
      paymentStatus: 'paid',
      review: { rating: 5, comment: 'Excellent work!', reviewedAt: new Date() },
      acceptedAt: new Date(Date.now() - 7200000),
      startedAt: new Date(Date.now() - 6000000),
      completedAt: new Date(Date.now() - 3600000),
      statusHistory: [
        { status: 'requested' },
        { status: 'accepted' },
        { status: 'in_progress' },
        { status: 'completed' },
      ],
    });
    console.log(`✅ Sample booking created`);

    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('  🌱 Seed complete! Test credentials:');
    console.log('  ─────────────────────────────────────────');
    console.log('  User:   danish@test.com   / test1234');
    console.log('  Worker: worker1@test.com  / worker1234');
    console.log('  Worker: worker2@test.com  / worker1234');
    console.log('  ...up to worker10@test.com');
    console.log('═══════════════════════════════════════════');
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
};

seed();
