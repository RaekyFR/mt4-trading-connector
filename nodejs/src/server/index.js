const express = require('express');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const config = require('../config');
const MT4Connector = require('../mt4/MT4Connector');
const SignalProcessor = require('../signals/SignalProcessor');
const RiskManager = require('../risk/RiskManager');

// Importation des routes
const webhookRouter = require('./routes/webhook');
const apiRouter = require('./routes/api');
const healthRouter = require('./routes/health');

class TradingServer {
  constructor() {
    this.app = express();
    this.prisma = new PrismaClient();
    this.mt4Connector = new MT4Connector(config.mt4);
    this.signalProcessor = new SignalProcessor(config.mt4);
    //this.riskManager = new RiskManager();
    this.riskManager = new RiskManager(this.mt4Connector);
    this.server = null;
  }

  async initialize() {
    console.log('[Server] Initialisation...');

    // Middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Logging des requêtes en mode debug
    if (config.debug) {
      this.app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
      });
    }

    // CORS pour l'interface web
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      next();
    });

    // Routes statiques pour l'interface web
    this.app.use(express.static(path.join(__dirname, '../../public')));

    // Injection des dépendances dans req
    this.app.use((req, res, next) => {
      req.prisma = this.prisma;
      req.mt4Connector = this.mt4Connector;
      req.signalProcessor = this.signalProcessor;
      req.riskManager = this.riskManager;
      next();
    });

    // Routes
    this.app.use('/health', healthRouter);
    this.app.use('/webhook', webhookRouter);
    this.app.use('/api', apiRouter);

    // Route par défaut pour l'interface web
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../public/index.html'));
    });

    // Gestion des erreurs
    this.app.use((err, req, res, next) => {
      console.error('[Server] Erreur:', err);
      res.status(500).json({
        error: 'Erreur serveur',
        message: config.debug ? err.message : 'Une erreur est survenue'
      });
    });

    // Démarrer MT4 Connector
    try {
      await this.mt4Connector.start();
      console.log('[Server] ✅ MT4 Connector démarré');
      try {
        const accountState = await this.riskManager.getAccountState();
        console.log('[Server] 📊 État du compte récupéré:', {
          balance: accountState.balance,
          freeMargin: accountState.freeMargin,
          source: accountState.source
        });
      } catch (accountError) {
        console.warn('[Server] ⚠️ Impossible de récupérer l\'état du compte:', accountError.message);
      }
    } catch (error) {
      console.error('[Server] ❌ Erreur MT4 Connector:', error);
      // Continuer même si MT4 n'est pas disponible
    }

    // Démarrer Signal Processor
    this.signalProcessor.start(config.signalProcessor.processInterval);
    console.log('[Server] ✅ Signal Processor démarré');
  }

  async start() {
    await this.initialize();

    this.server = this.app.listen(config.server.port, config.server.host, () => {
      console.log(`[Server] 🚀 Serveur démarré sur http://${config.server.host}:${config.server.port}`);
      console.log(`[Server] 📡 Webhook disponible sur ${config.webhook.path}`);
    });
  }

  async stop() {
    console.log('[Server] Arrêt en cours...');

    // Arrêter le serveur HTTP
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
    }

    // Arrêter les composants
    await this.signalProcessor.cleanup();
    await this.mt4Connector.stop();
    await this.riskManager.cleanup();
    await this.prisma.$disconnect();

    console.log('[Server] ✅ Arrêt complet');
  }
}

// Export pour utilisation directe
if (require.main === module) {
  const server = new TradingServer();
  
  server.start().catch((error) => {
    console.error('[Server] Erreur fatale:', error);
    process.exit(1);
  });

  // Gestion de l'arrêt propre
  process.on('SIGINT', async () => {
    console.log('\n[Server] Signal SIGINT reçu');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Server] Signal SIGTERM reçu');
    await server.stop();
    process.exit(0);
  });
}

module.exports = TradingServer;