require('dotenv').config();

module.exports = {
  // Configuration MT4
  mt4: {
    folder: process.env.FOLDER_PATH,
    commandTimeout: parseInt(process.env.MT4_COMMAND_TIMEOUT) || 5000,
    responseCheckInterval: parseInt(process.env.MT4_RESPONSE_CHECK_INTERVAL) || 500,
    commandInterval: parseInt(process.env.MT4_COMMAND_INTERVAL) || 5000
  },

  // Configuration du serveur
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0'
  },

  // Configuration du webhook
  webhook: {
    secret: process.env.WEBHOOK_SECRET || 'your-webhook-secret',
    path: process.env.WEBHOOK_PATH || '/webhook/tradingview'
  },

  // Configuration du Signal Processor
  signalProcessor: {
    processInterval: parseInt(process.env.SIGNAL_PROCESS_INTERVAL) || 5000,
    maxSignalsPerBatch: parseInt(process.env.MAX_SIGNALS_PER_BATCH) || 10
  },

  // Configuration du Risk Manager
  risk: {
    defaultRiskPercent: parseFloat(process.env.DEFAULT_RISK_PERCENT) || 1.0,
    maxRiskPercent: parseFloat(process.env.MAX_RISK_PERCENT) || 2.0
  },

  // Configuration de la base de données
  database: {
    url: process.env.DATABASE_URL
  },

  // Mode debug
  debug: process.env.NODE_ENV !== 'production'
};
