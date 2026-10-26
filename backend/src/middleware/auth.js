const jwt = require('jsonwebtoken');
const { findUserById } = require('../data/store');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters.');
}
async function authenticateToken(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Missing token.',
      code: 'UNAUTHORIZED'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid authentication session. User not found.',
        code: 'USER_NOT_FOUND'
      });
    }

    req.user = {
      id: String(user._id || user.id),
      _id: String(user._id || user.id),
      email: user.email,
      name: user.name,
      preferences: user.preferences
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Authentication session expired. Please sign in again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(401).json({
      error: 'Invalid authentication token.',
      code: 'INVALID_TOKEN'
    });
  }
}

module.exports = {
  authenticateToken,
  JWT_SECRET
};
