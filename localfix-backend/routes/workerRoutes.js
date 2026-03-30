const express = require('express');
const router = express.Router();
const { protect, requireWorker } = require('../middleware/auth');
const {
  getWorkers,
  getWorkerById,
  getCategories,
  updateWorkerLocation,
} = require('../controllers/workerController');

// GET /api/workers/categories
router.get('/categories', getCategories);

// GET /api/workers?category=electrician&lat=30.9&lng=75.8
router.get('/', getWorkers);

// GET /api/workers/:id
router.get('/:id', getWorkerById);

// PUT /api/workers/location (protected, worker only)
router.put('/location', protect, requireWorker, updateWorkerLocation);

module.exports = router;
