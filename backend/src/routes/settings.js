const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { findUserById, updateUserPreferences } = require('../data/store');

router.use(authenticateToken);

// Get real user preferences/settings
router.get('/', async (req, res, next) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json({
      settings: user.preferences || {
        theme: 'obsidian',
        defaultSort: 'updatedAt_desc',
        graphShowSharedTags: true
      }
    });
  } catch (err) {
    next(err);
  }
});

// Update working settings only
router.patch('/', async (req, res, next) => {
  try {
    const { theme, defaultSort, graphShowSharedTags } = req.body;
    const allowed = {};

    if (theme !== undefined) {
      if (!['dark', 'obsidian', 'violet'].includes(theme)) {
        return res.status(400).json({ error: 'Invalid theme selected' });
      }
      allowed.theme = theme;
    }

    if (defaultSort !== undefined) {
      if (!['updatedAt_desc', 'updatedAt_asc', 'title_asc', 'title_desc'].includes(defaultSort)) {
        return res.status(400).json({ error: 'Invalid sort preference' });
      }
      allowed.defaultSort = defaultSort;
    }

    if (graphShowSharedTags !== undefined) {
      allowed.graphShowSharedTags = Boolean(graphShowSharedTags);
    }

    const updated = await updateUserPreferences(req.user.id, allowed);
    return res.status(200).json({
      message: 'Settings updated successfully',
      settings: updated
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
