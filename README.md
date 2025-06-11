# 📊 Trading Bot MT4 + Node.js + Prisma

Automatisation d'ordres sur MetaTrader 4 via des signaux externes (TradingView) et une stratégie définie en base de données.

## 🔧 Stack

- Node.js
- Prisma ORM
- SQLite
- MetaTrader 4
- Fichiers de communication MT4 ↔ Node.js

## 🚀 Démarrage

```bash
npm install
npx prisma migrate dev --name init
npm run dev
