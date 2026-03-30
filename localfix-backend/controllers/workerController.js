const Worker = require('../models/Worker');
const { asyncHandler } = require('../middleware/errorHandler');

// ─── GET /api/workers ─────────────────────────────────────────────────────
// Find available workers — optionally filter by category and location
const getWorkers = asyncHandler(async (req, res) => {
  const { category, lat, lng, radius = 10 } = req.query;

  const filter = { isOnline: true, isBusy: false, isActive: true };
  if (category) filter.category = category;

  let workers;

  // If lat/lng provided, do geospatial query
  if (lat && lng) {
    const radiusInMeters = parseFloat(radius) * 1000; // km → meters
    workers = await Worker.find({
      ...filter,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: radiusInMeters,
        },
      },
    }).select('-password -aadharNumber -bankDetails -socketId');
  } else {
    // Fallback: return all available workers (mock)
    workers = await Worker.find(filter)
      .select('-password -aadharNumber -bankDetails -socketId')
      .sort({ 'rating.average': -1 })
      .limit(20);
  }

  // Add mock distance if no real location provided
  const workersWithDistance = workers.map((w) => {
    const workerObj = w.toObject();
    if (!lat || !lng) {
      // Mock distance 0.5 – 5 km
      workerObj.distance = (Math.random() * 4.5 + 0.5).toFixed(1);
    }
    return workerObj;
  });

  res.status(200).json({
    success: true,
    count: workers.length,
    workers: workersWithDistance,
  });
});

// ─── GET /api/workers/:id ─────────────────────────────────────────────────
const getWorkerById = asyncHandler(async (req, res) => {
  const worker = await Worker.findById(req.params.id).select(
    '-password -aadharNumber -bankDetails -socketId'
  );

  if (!worker) {
    return res.status(404).json({ success: false, message: 'Worker not found.' });
  }

  res.status(200).json({ success: true, worker });
});

// ─── GET /api/workers/categories ─────────────────────────────────────────
const getCategories = asyncHandler(async (req, res) => {
  const categories = [
    { id: 'electrician', label: 'Electrician', icon: '⚡', color: 'yellow' },
    { id: 'plumber', label: 'Plumber', icon: '🚿', color: 'blue' },
    { id: 'ac_technician', label: 'AC Repair', icon: '❄️', color: 'teal' },
    { id: 'carpenter', label: 'Carpenter', icon: '🪵', color: 'orange' },
    { id: 'mechanic', label: 'Mechanic', icon: '🔩', color: 'red' },
    { id: 'cleaning', label: 'Cleaning', icon: '🧹', color: 'green' },
    { id: 'painter', label: 'Painter', icon: '🎨', color: 'purple' },
    { id: 'appliance_repair', label: 'Appliances', icon: '🔧', color: 'pink' },
  ];

  // Get count of available workers per category
  const counts = await Worker.aggregate([
    { $match: { isOnline: true, isBusy: false, isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  const countMap = {};
  counts.forEach((c) => (countMap[c._id] = c.count));

  const enriched = categories.map((cat) => ({
    ...cat,
    availableWorkers: countMap[cat.id] || 0,
  }));

  res.status(200).json({ success: true, categories: enriched });
});

// ─── PUT /api/workers/location (protected, worker) ───────────────────────
const updateWorkerLocation = asyncHandler(async (req, res) => {
  const { lat, lng, city } = req.body;

  if (!lat || !lng) {
    return res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });
  }

  const worker = await Worker.findByIdAndUpdate(
    req.user._id,
    {
      'location.coordinates': [parseFloat(lng), parseFloat(lat)],
      ...(city && { 'location.city': city }),
    },
    { new: true }
  );

  // Broadcast location update via socket
  const io = req.app.get('io');
  if (io && worker.socketId) {
    io.emit('workerLocationUpdate', {
      workerId: worker._id,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    });
  }

  res.status(200).json({ success: true, message: 'Location updated.' });
});

module.exports = { getWorkers, getWorkerById, getCategories, updateWorkerLocation };
