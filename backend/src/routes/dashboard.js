const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getDashboardMetrics, getGraphData } = require('../data/store');

router.use(authenticateToken);

// Dashboard metrics: real counts, recent notes, journal status
router.get('/dashboard', async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id || req.userId;
    const metrics = await getDashboardMetrics(userId);
    return res.status(200).json(metrics);
  } catch (err) {
    next(err);
  }
});

// Knowledge graph: nodes, edges, connection rules, with optional relationship filters
router.get('/graph', async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.explicit !== undefined) filters.explicit = req.query.explicit === 'true';
    if (req.query.contentMentions !== undefined) filters.contentMentions = req.query.contentMentions === 'true';
    if (req.query.mentions !== undefined) filters.contentMentions = req.query.mentions === 'true';
    if (req.query.sharedTags !== undefined) filters.sharedTags = req.query.sharedTags === 'true';
    if (req.query.tags !== undefined) filters.sharedTags = req.query.tags === 'true';

    const graph = await getGraphData(req.user.id, filters);
    return res.status(200).json(graph);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
