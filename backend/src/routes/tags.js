const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getTags } = require('../data/store');

router.use(authenticateToken);

// Get all tags for the authenticated user with note counts
router.get('/', async (req, res, next) => {
  try {
    const tags = await getTags(req.user.id);
    return res.status(200).json({
      tags,
      totalTags: tags.length
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
