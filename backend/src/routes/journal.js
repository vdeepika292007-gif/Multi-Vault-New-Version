const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getJournalEntry,
  getJournalHistory,
  upsertJournalEntry
} = require('../data/store');

router.use(authenticateToken);

// Get journal entry by date query or list recent journal history
router.get('/', async (req, res, next) => {
  try {
    const { date } = req.query;

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Date must be formatted as YYYY-MM-DD' });
      }
      const entry = await getJournalEntry(req.user.id, date);
      return res.status(200).json({
        entry: entry || { entryDate: date, content: '', isNew: true }
      });
    }

    // Default: return recent journal entries history
    const history = await getJournalHistory(req.user.id);
    return res.status(200).json({
      history,
      totalEntries: history.length
    });
  } catch (err) {
    next(err);
  }
});

// Create or update journal entry for specific date (enforces 1 entry per date per user)
router.put('/:date', async (req, res, next) => {
  try {
    const { date } = req.params;
    const { content, linkedNoteIds } = req.body;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date must be formatted as YYYY-MM-DD' });
    }

    const entry = await upsertJournalEntry(req.user.id, date, content || '', linkedNoteIds);
    return res.status(200).json({
      message: 'Journal entry saved successfully',
      entry
    });
  } catch (err) {
    next(err);
  }
});

// Get journal entry by date path parameter
router.get('/:date', async (req, res, next) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date must be formatted as YYYY-MM-DD' });
    }
    const entry = await getJournalEntry(req.user.id, date);
    return res.status(200).json({
      entry: entry || { entryDate: date, content: '', isNew: true }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
