const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Démarrage du seed...");

  // 1. Ajoute des symboles
  const btc = await prisma.symbol.upsert({
    where: { name: "BTCUSD" },
    update: {},
    create: { name: "BTCUSD" },
  });

  const eur = await prisma.symbol.upsert({
    where: { name: "EURUSD" },
    update: {},
    create: { name: "EURUSD" },
  });

  // 2. Crée une stratégie
  const breakout = await prisma.strategy.create({
    data: {
      name: "Breakout RSI",
      isActive: true,
    }
  });

  // 3. Ajoute une règle à la stratégie
  await prisma.strategyRule.create({
    data: {
      strategyId: breakout.id,
      field: "confidence",
      operator: ">=",
      value: "70",
      type: "signal"
    }
  });

  // 4. Ajoute un signal complet
  const signal = await prisma.signal.create({
    data: {
      symbolId: btc.id,
      strategyId: breakout.id,
      action: "open",
      direction: "buy",
      type: "market",
      sl: 30000,
      tp: 34000,
      lot: 0.1,
      confidence: 80,
      source: "tradingview",
      comment: "Breakout RSI 80"
    }
  });

  // 5. Crée un ordre lié à ce signal
  await prisma.order.create({
    data: {
      symbolId: btc.id,
      strategyId: breakout.id,
      signalOpenId: signal.id,
      lot: 0.1,
      sl: 30000,
      tp: 34000,
      type: "buy",
      comment: "Ordre ouvert depuis seed",
      state: "en_attente"
    }
  });

  console.log("✅ Données initiales insérées avec succès !");
}

main()
  .catch((e) => {
    console.error("❌ Erreur dans le seed :", e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
