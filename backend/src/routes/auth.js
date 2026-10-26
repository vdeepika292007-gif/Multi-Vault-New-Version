const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findUserByEmail, createUser, findUserById } = require('../data/store');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// Register a new user
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const normEmail = email.trim().toLowerCase();
    const existing = await findUserByEmail(normEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await createUser({
      name: name.trim(),
      email: normEmail,
      passwordHash,
      preferences: {
        theme: 'obsidian',
        defaultSort: 'updatedAt_desc',
        graphShowSharedTags: true
      }
    });

    const token = jwt.sign(
      { userId: String(user._id || user.id), email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Account registered successfully',
      token,
      user: {
        id: String(user._id || user.id),
        name: user.name,
        email: user.email,
        preferences: user.preferences
      }
    });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normEmail = email.trim().toLowerCase();
    const user = await findUserByEmail(normEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password credentials' });
    }

    const token = jwt.sign(
      { userId: String(user._id || user.id), email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Logged in successfully',
      token,
      user: {
        id: String(user._id || user.id),
        name: user.name,
        email: user.email,
        preferences: user.preferences
      }
    });
  } catch (err) {
    next(err);
  }
});

// Logout
router.post('/logout', (req, res) => {
  return res.status(200).json({ message: 'Logged out successfully' });
});

// Get current authenticated user
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    return res.status(200).json({
      user: {
        id: String(user._id || user.id),
        name: user.name,
        email: user.email,
        preferences: user.preferences,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
