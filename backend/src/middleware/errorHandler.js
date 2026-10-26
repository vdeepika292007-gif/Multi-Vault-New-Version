function errorHandler(err, req, res, next) {
  console.error('[API Error]:', err.message);

  // Mongoose / Unique constraint duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      error: `A record with this ${field} already exists.`,
      code: 'DUPLICATE_ENTRY'
    });
  }

  // Mongoose schema validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: messages.join(', '),
      code: 'VALIDATION_ERROR'
    });
  }

  // Invalid JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Malformed JSON payload in request body',
      code: 'INVALID_JSON'
    });
  }

  // CastError (e.g. invalid MongoDB ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: `Invalid identifier format for ${err.path}`,
      code: 'INVALID_ID'
    });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    code: 'INTERNAL_ERROR'
  });
}

module.exports = errorHandler;
