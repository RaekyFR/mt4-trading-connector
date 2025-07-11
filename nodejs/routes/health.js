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

// ========================================

// nodejs/package.json (mis à jour)
{
  "name": "tv_mt4_bridge",
  "version": "2.0.0",
  "description": "Pont TradingView ↔ MT4 avec Risk Management avancé",
  "main": "src/server/index.js",
  "scripts": {
    "start": "node src/server/index.js",
    "dev": "NODE_ENV=development node src/server/index.js",
    "test": "node test/run-tests.js",
    "test:mt4": "node test/mt4-connection.test.js",
    "test:risk": "node test/risk-manager.test.js",
    "init-db": "npx prisma db push && node scripts/init-db.js",
    "reset-db": "node scripts/reset-db.js",
    "prisma:generate": "npx prisma generate",
    "prisma:migrate": "npx prisma migrate dev",
    "prisma:studio": "npx prisma studio",
    "signal:test": "node scripts/test-signal.js",
    "mt4:ping": "node ping_test.js",
    "mt4:balance": "node test/test-balance.js",
    "mt4:order": "node market_test.js"
  },
  "dependencies": {
    "@prisma/client": "^6.9.0",
    "dotenv": "^16.5.0",
    "express": "^5.1.0",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "prisma": "^6.9.0"
  },
  "keywords": [
    "trading",
    "mt4",
    "tradingview",
    "risk-management",
    "automated-trading"
  ],
  "author": "Votre Nom",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  }
}

// ========================================

// nodejs/scripts/test-signal.js
// Script pour tester l'envoi d'un signal complet
require('dotenv').config();
const fetch = require('node-fetch'); // npm install node-fetch si nécessaire

async function testSignal() {
  const signal = {
    strategy: 'TestStrategy',
    action: 'buy',
    symbol: 'EURUSD',
    price: 1.0850,
    stopLoss: 1.0800,
    takeProfit: 1.0950,
    lot: 0.1,
    comment: 'Test signal from script'
  };

  console.log('📤 Envoi du signal:', signal);

  try {
    const response = await fetch('http://localhost:3000/webhook/tradingview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET || ''
      },
      body: JSON.stringify(signal)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Signal accepté:', result);
    } else {
      console.log('❌ Signal rejeté:', result);
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

testSignal();

// ========================================

// nodejs/README.md
# Pont TradingView ↔ MT4 avec Risk Management

## Phase 2 - Architecture complète

### 🚀 Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos paramètres

# 3. Initialiser la base de données
npm run init-db

# 4. Démarrer le serveur
npm start
```

### 📁 Structure du projet

```
nodejs/
├── src/
│   ├── config/         # Configuration centralisée
│   ├── mt4/           # Connecteur MT4
│   ├── risk/          # Risk Manager
│   ├── signals/       # Signal Processor
│   └── server/        # Serveur Express + API
├── scripts/           # Scripts utilitaires
├── test/             # Tests
├── public/           # Interface web
└── prisma/           # Schéma base de données
```

### 🔧 Configuration

Éditer `.env` :
- `FOLDER_PATH` : Chemin vers MQL4/Files
- `DATABASE_URL` : URL SQLite (par défaut: file:./dev.db)
- `WEBHOOK_SECRET` : Secret pour sécuriser le webhook
- `PORT` : Port du serveur (défaut: 3000)

### 📡 API Endpoints

#### Webhook TradingView
- `POST /webhook/tradingview` - Réception des signaux

#### Account
- `GET /api/account/state` - État du compte
- `GET /api/account/metrics` - Métriques de performance

#### Strategies
- `GET /api/strategies` - Liste des stratégies
- `POST /api/strategies` - Créer une stratégie
- `PUT /api/strategies/:id` - Modifier une stratégie

#### Signals
- `GET /api/signals` - Liste des signaux
- `GET /api/signals/:id` - Détails d'un signal

#### Orders
- `GET /api/orders` - Liste des ordres
- `POST /api/orders/close/:ticket` - Fermer un ordre
- `POST /api/orders/close-all` - Fermer toutes les positions

#### Risk Management
- `GET /api/risk/config` - Configuration de risk
- `PUT /api/risk/config` - Modifier la configuration
- `GET /api/risk/metrics` - Métriques de risk

#### System
- `GET /api/system/status` - Statut du système
- `POST /api/system/restart` - Redémarrer les composants

### 🧪 Tests

```bash
# Tester la connexion MT4
npm run mt4:ping

# Tester l'envoi d'un signal
npm run signal:test

# Tester un ordre au marché
npm run mt4:order
```

### 🎯 Utilisation avec TradingView

1. Dans TradingView, créer une alerte
2. Dans le message de l'alerte, utiliser le format JSON :
```json
{
  "strategy": "MyStrategy",
  "action": "{{strategy.order.action}}",
  "symbol": "{{ticker}}",
  "price": {{strategy.order.price}},
  "stopLoss": {{plot_0}},
  "takeProfit": {{plot_1}}
}
```
3. URL du webhook : `http://votre-serveur:3000/webhook/tradingview`
4. Si configuré, ajouter `?secret=votre-secret` à l'URL

### 🛡️ Risk Management

Le système valide automatiquement chaque signal selon :
- Limites quotidiennes/hebdomadaires/mensuelles
- Nombre maximum de positions
- Exposition totale maximale
- Corrélations entre positions
- Heures de trading autorisées

### 📊 Interface Web

Accéder à `http://localhost:3000` pour :
- Monitoring en temps réel
- Gestion des stratégies
- Visualisation des performances
- Configuration du risk management
- Logs et audit trail

### 🔍 Dépannage

1. **MT4 ne répond pas** : Vérifier que l'EA est activé et que le chemin `FOLDER_PATH` est correct
2. **Signaux rejetés** : Consulter les logs dans `/api/logs`
3. **Base de données corrompue** : `npm run reset-db --force` puis `npm run init-db`

### 📝 TODO Phase 3

- [ ] Interface web complète avec graphiques
- [ ] Notifications (email, telegram)
- [ ] Backtesting intégré
- [ ] Multi-compte MT4
- [ ] API REST pour clients externes