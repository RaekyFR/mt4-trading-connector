// nodejs/scripts/init-db.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function initDatabase() {
  console.log('🔧 Initialisation de la base de données...');

  try {
    // 1. Créer une stratégie par défaut
    const defaultStrategy = await prisma.strategy.upsert({
      where: { name: 'Default' },
      update: {},
      create: {
        name: 'Default',
        description: 'Stratégie par défaut pour les tests',
        isActive: true,
        maxDailyLoss: 5.0,
        maxPositions: 3,
        maxLotSize: 0.5,
        defaultRiskPercent: 1.0,
        allowedSymbols: JSON.stringify(['EURUSD', 'GBPUSD', 'BTCUSD', 'XAUUSD']),
        tradingHours: JSON.stringify({
          start: '08:00',
          end: '22:00'
        })
      }
    });

    console.log('✅ Stratégie par défaut créée:', defaultStrategy.name);

    // 2. Créer une configuration de risk globale
    const globalRiskConfig = await prisma.riskConfig.upsert({
      where: { id: 'global-risk-config' },
      update: {},
      create: {
        id: 'global-risk-config',
        strategyId: null, // Configuration globale
        maxDailyLoss: 5.0,
        maxWeeklyLoss: 10.0,
        maxMonthlyLoss: 20.0,
        maxDrawdown: 15.0,
        maxTotalPositions: 5,
        maxPositionsPerSymbol: 2,
        maxLotSize: 1.0,
        maxTotalExposure: 5.0,
        defaultRiskPercent: 1.0,
        maxRiskPercent: 2.0,
        useKellyCriterion: false,
        maxCorrelation: 0.7,
        correlationPeriod: 20,
        tradingHours: JSON.stringify({
          monday: { start: '08:00', end: '22:00' },
          tuesday: { start: '08:00', end: '22:00' },
          wednesday: { start: '08:00', end: '22:00' },
          thursday: { start: '08:00', end: '22:00' },
          friday: { start: '08:00', end: '20:00' }
        }),
        blockedDates: JSON.stringify(['2025-12-25', '2025-01-01']),
        stopTradingOnLoss: true,
        requireConfirmation: false,
        isActive: true
      }
    });

    console.log('✅ Configuration de risk globale créée');

    // 3. Créer un état de compte initial
    const accountState = await prisma.accountState.create({
      data: {
        accountNumber: 12345678,
        broker: 'Demo Broker',
        currency: 'USD',
        balance: 10000,
        equity: 10000,
        margin: 0,
        freeMargin: 10000,
        marginLevel: 0,
        totalTrades: 0,
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0
      }
    });

    console.log('✅ État du compte initial créé');

    // 4. Créer quelques signaux de test (optionnel)
    if (process.env.CREATE_TEST_DATA === 'true') {
      const testSignal = await prisma.signal.create({
        data: {
          strategyId: defaultStrategy.id,
          action: 'buy',
          symbol: 'EURUSD',
          price: 1.0850,
          stopLoss: 1.0800,
          takeProfit: 1.0950,
          suggestedLot: 0.1,
          status: 'PENDING',
          rawData: JSON.stringify({
            strategy: 'Default',
            action: 'buy',
            symbol: 'EURUSD',
            price: 1.0850,
            stopLoss: 1.0800,
            takeProfit: 1.0950,
            lot: 0.1,
            source: 'test'
          }),
          source: 'test'
        }
      });

      console.log('✅ Signal de test créé:', testSignal.id);
    }

    // 5. Créer une entrée de log initiale
    await prisma.auditLog.create({
      data: {
        action: 'system_initialized',
        entityType: 'system',
        details: JSON.stringify({
          timestamp: new Date(),
          version: '2.0.0'
        }),
        severity: 'INFO'
      }
    });

    console.log('✅ Log d\'audit initial créé');

    console.log('\n🎉 Base de données initialisée avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter l'initialisation
initDatabase();

// ========================================

// nodejs/scripts/reset-db.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('⚠️  Réinitialisation de la base de données...');
  
  const confirm = process.argv[2] === '--force';
  if (!confirm) {
    console.log('Utilisez --force pour confirmer la réinitialisation');
    process.exit(1);
  }

  try {
    // Supprimer toutes les données dans l'ordre inverse des dépendances
    await prisma.auditLog.deleteMany({});
    console.log('✅ Logs d\'audit supprimés');

    await prisma.riskMetric.deleteMany({});
    console.log('✅ Métriques de risk supprimées');

    await prisma.order.deleteMany({});
    console.log('✅ Ordres supprimés');

    await prisma.signal.deleteMany({});
    console.log('✅ Signaux supprimés');

    await prisma.riskConfig.deleteMany({});
    console.log('✅ Configurations de risk supprimées');

    await prisma.strategy.deleteMany({});
    console.log('✅ Stratégies supprimées');

    await prisma.accountState.deleteMany({});
    console.log('✅ États de compte supprimés');

    console.log('\n🔧 Base de données réinitialisée !');
    console.log('Exécutez "npm run init-db" pour recréer les données de base');

  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();

// ========================================

// nodejs/src/config/index.js
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

// ========================================

// nodejs/.env.example
# Configuration MT4
FOLDER_PATH=C:\\Users\\YOUR_USER\\AppData\\Roaming\\MetaQuotes\\Terminal\\YOUR_TERMINAL_ID\\MQL4\\Files
MT4_COMMAND_TIMEOUT=5000
MT4_RESPONSE_CHECK_INTERVAL=500
MT4_COMMAND_INTERVAL=5000

# Configuration Serveur
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Configuration Webhook
WEBHOOK_SECRET=your-secret-key-here
WEBHOOK_PATH=/webhook/tradingview

# Configuration Signal Processor
SIGNAL_PROCESS_INTERVAL=5000
MAX_SIGNALS_PER_BATCH=10

# Configuration Risk Manager
DEFAULT_RISK_PERCENT=1.0
MAX_RISK_PERCENT=2.0

# Base de données
DATABASE_URL="file:./dev.db"

# Options de développement
CREATE_TEST_DATA=false