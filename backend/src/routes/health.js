const express = require('express');
const router = express.Router();
const { getDbStatus } = require('../config/db');

router.get('/health', (req, res) => {
  const dbStatus = getDbStatus();
  res.status(200).json({
    status: 'ok',
    service: 'Multi Vault API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus.connected ? 'healthy' : 'degraded',
      mode: dbStatus.mode,
      storage: dbStatus.uri
    }
  });
});

module.exports = router;
