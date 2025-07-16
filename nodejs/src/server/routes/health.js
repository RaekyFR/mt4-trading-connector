// nodejs/src/server/routes/health.js
const express = require('express');
const router = express.Router();

/**
 * GET /health
 * Vérification basique de santé
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/detailed
 * Vérification détaillée de tous les composants
 */
router.get('/detailed', async (req, res) => {
  const checks = {
    api: 'healthy',
    database: 'unknown',
    mt4: 'unknown',
    signalProcessor: 'unknown'
  };

  try {
    // Test de la base de données
    await req.prisma.$queryRaw`SELECT 1`;
    checks.database = 'healthy';
  } catch (error) {
    checks.database = 'unhealthy';
  }

  // Test de MT4
  checks.mt4 = req.mt4Connector.isConnected ? 'healthy' : 'unhealthy';

  // Test du Signal Processor
  checks.signalProcessor = req.signalProcessor.processInterval ? 'healthy' : 'unhealthy';

  const allHealthy = Object.values(checks).every(status => status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
