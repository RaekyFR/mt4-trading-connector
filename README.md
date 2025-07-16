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