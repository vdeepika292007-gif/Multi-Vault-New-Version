const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  findNotes,
  findNoteById,
  createNote,
  updateNote,
  deleteNote
} = require('../data/store');

// All note routes require authentication
router.use(authenticateToken);

// List notes with search, tag filter, and sorting
router.get('/', async (req, res, next) => {
  try {
    const { search, tag, sort } = req.query;
    const notes = await findNotes(req.user.id, { search, tag, sort });
    return res.status(200).json({
      notes,
      total: notes.length,
      filters: { search: search || '', tag: tag || '', sort: sort || 'updatedAt_desc' }
    });
  } catch (err) {
    next(err);
  }
});

// Create note
router.post('/', async (req, res, next) => {
  try {
    const { title, content, resourceUrl, tags, linkedNoteIds } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Note title is required' });
    }

    const note = await createNote({
      userId: req.user.id,
      title: title.trim(),
      content: content || '',
      resourceUrl: resourceUrl || '',
      tags: Array.isArray(tags) ? tags : [],
      linkedNoteIds: Array.isArray(linkedNoteIds) ? linkedNoteIds : []
    });

    return res.status(201).json({
      message: 'Note created successfully',
      note
    });
  } catch (err) {
    next(err);
  }
});

// Get note by ID
router.get('/:id', async (req, res, next) => {
  try {
    const note = await findNoteById(req.user.id, req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found or access denied' });
    }
    return res.status(200).json({ note });
  } catch (err) {
    next(err);
  }
});

// Update note (support both PATCH and PUT)
const handleNoteUpdate = async (req, res, next) => {
  try {
    const { title, content, resourceUrl, tags, linkedNoteIds } = req.body;

    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }

    const existing = await findNoteById(req.user.id, req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Note not found or access denied' });
    }

    const updated = await updateNote(req.user.id, req.params.id, {
      title,
      content,
      resourceUrl,
      tags,
      linkedNoteIds
    });

    return res.status(200).json({
      message: 'Note updated successfully',
      note: updated
    });
  } catch (err) {
    next(err);
  }
};
router.patch('/:id', handleNoteUpdate);
router.put('/:id', handleNoteUpdate);

// Delete note
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await findNoteById(req.user.id, req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Note not found or access denied' });
    }

    await deleteNote(req.user.id, req.params.id);
    return res.status(200).json({ message: 'Note deleted successfully', id: req.params.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
