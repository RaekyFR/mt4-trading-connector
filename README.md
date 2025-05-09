
---

## ⚡ Technologies utilisées

- Node.js (serveur TCP, réception Webhooks TradingView)
- MQL4 (MetaTrader 4 - Expert Advisor client TCP)
- PostgreSQL (gestion base de données)
- Bootstrap 5 (future interface web simplifiée)

---

## 🔥 Fonctionnement rapide

1. **TradingView** envoie un signal via webhook (ports 80/443).
2. **Node.js** capture le signal et le transforme au format JSON.
3. **EA MT4 (client TCP)** se connecte et reçoit les ordres en direct.
4. **MT4** passe les ordres de trading automatiquement.

---

## 🚀 Comment démarrer ?

### Node.js (serveur)
```bash
cd nodejs/
npm install
npm install express
node server.js
