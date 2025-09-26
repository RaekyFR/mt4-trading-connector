// test-ftmo-all-symbols.js
const PositionCalculator = require('./src/risk/PositionCalculator');

async function testAllSymbols() {
  console.log('🧪 Test FTMO PositionCalculator - Toutes catégories\n');
  
  const calculator = new PositionCalculator();
  
  const testConfig = {
    balance: 10000,
    freeMargin: 9000,
    riskPercent: 1.0,
    maxLotSize: 50 // Large pour voir les vraies limites
  };
  
  console.log('Configuration test:', testConfig);
  console.log('=' .repeat(80));

  // 1. FOREX - Levier 30:1
  console.log('\n📈 CATÉGORIE FOREX (Levier 30:1)');
  console.log('-'.repeat(50));
  
  const forexTests = [
    {
      symbol: 'EURUSD',
      entryPrice: 1.1000,
      stopLoss: 1.0950,
      distance: '50 pips'
    },
    {
      symbol: 'GBPUSD', 
      entryPrice: 1.2500,
      stopLoss: 1.2450,
      distance: '50 pips'
    },
    {
      symbol: 'USDJPY',
      entryPrice: 150.00,
      stopLoss: 149.50,
      distance: '50 pips'
    }
  ];
  
  for (const test of forexTests) {
    console.log(`\n${test.symbol} - Distance: ${test.distance}`);
    try {
      const result = await calculator.calculateLotSize({
        ...testConfig,
        symbol: test.symbol,
        entryPrice: test.entryPrice,
        stopLoss: test.stopLoss
      });
      
      console.log(`  Lot calculé: ${result.lotSize}`);
      console.log(`  Marge utilisée: $${result.marginUsed}`);
      console.log(`  Risque NET: $${result.riskAmount} (${result.riskPercent}%)`);
      console.log(`  Coûts transaction: $${result.transactionCosts}`);
      console.log(`  Limité par: ${result.limitedBy}`);
      console.log(`  Levier effectif: ${result.leverage}:1`);
      
    } catch (error) {
      console.log(`  ❌ Erreur: ${error.message}`);
    }
  }

  // 2. INDICES - Levier 15:1
  console.log('\n\n📊 CATÉGORIE INDICES (Levier 15:1)');
  console.log('-'.repeat(50));
  
  const indexTests = [
    {
      symbol: 'US500',
      entryPrice: 6642,
      stopLoss: 6625,
      distance: '17 points'
    },
    {
      symbol: 'NAS100',
      entryPrice: 16000,
      stopLoss: 15980,
      distance: '20 points'
    }
  ];
  
  for (const test of indexTests) {
    console.log(`\n${test.symbol} - Distance: ${test.distance}`);
    try {
      const result = await calculator.calculateLotSize({
        ...testConfig,
        symbol: test.symbol,
        entryPrice: test.entryPrice,
        stopLoss: test.stopLoss
      });
      
      console.log(`  Lot calculé: ${result.lotSize}`);
      console.log(`  Marge utilisée: $${result.marginUsed}`);
      console.log(`  Risque NET: $${result.riskAmount} (${result.riskPercent}%)`);
      console.log(`  Coûts transaction: $${result.transactionCosts}`);
      console.log(`  - Spread: $${result.spreadCost}`);
      console.log(`  - Commission: $${result.commissionCost}`);
      console.log(`  Limité par: ${result.limitedBy}`);
      console.log(`  Position value: $${result.positionValue}`);
      
    } catch (error) {
      console.log(`  ❌ Erreur: ${error.message}`);
    }
  }

  // 3. MÉTAUX - Levier 9:1
  console.log('\n\n🥇 CATÉGORIE MÉTAUX (Levier 9:1)');
  console.log('-'.repeat(50));
  
  const metalTests = [
    {
      symbol: 'XAUUSD',
      entryPrice: 2000,
      stopLoss: 1990,
      distance: '10$'
    }
  ];
  
  for (const test of metalTests) {
    console.log(`\n${test.symbol} - Distance: ${test.distance}`);
    try {
      const result = await calculator.calculateLotSize({
        ...testConfig,
        symbol: test.symbol,
        entryPrice: test.entryPrice,
        stopLoss: test.stopLoss
      });
      
      console.log(`  Lot calculé: ${result.lotSize}`);
      console.log(`  Marge utilisée: $${result.marginUsed}`);
      console.log(`  Risque NET: $${result.riskAmount} (${result.riskPercent}%)`);
      console.log(`  Coûts transaction: $${result.transactionCosts}`);
      console.log(`  - Spread: $${result.spreadCost}`);
      console.log(`  - Commission: $${result.commissionCost}`);
      console.log(`  Limité par: ${result.limitedBy}`);
      console.log(`  Positions max théoriques: ${Math.floor(9000 / result.marginUsed)}`);
      
    } catch (error) {
      console.log(`  ❌ Erreur: ${error.message}`);
    }
  }

  // 4. CRYPTOS - Levier 1:1
  console.log('\n\n₿ CATÉGORIE CRYPTOS (Levier 1:1)');
  console.log('-'.repeat(50));
  
  const cryptoTests = [
    {
      symbol: 'BTCUSD',
      entryPrice: 60000,
      stopLoss: 59000,
      distance: '1000$'
    }
  ];
  
  for (const test of cryptoTests) {
    console.log(`\n${test.symbol} - Distance: ${test.distance}`);
    try {
      const result = await calculator.calculateLotSize({
        ...testConfig,
        symbol: test.symbol,
        entryPrice: test.entryPrice,
        stopLoss: test.stopLoss
      });
      
      console.log(`  Lot calculé: ${result.lotSize}`);
      console.log(`  Marge utilisée: $${result.marginUsed}`);
      console.log(`  Risque NET: $${result.riskAmount} (${result.riskPercent}%)`);
      console.log(`  Coûts transaction: $${result.transactionCosts}`);
      console.log(`  - Spread: $${result.spreadCost}`);
      console.log(`  - Commission: $${result.commissionCost} (!)`);
      console.log(`  Limité par: ${result.limitedBy}`);
      console.log(`  ⚠️ Commission représente ${((result.commissionCost/result.riskAmount)*100).toFixed(1)}% du risque`);
      
    } catch (error) {
      console.log(`  ❌ Erreur: ${error.message}`);
    }
  }

  // 5. ANALYSE COMPARATIVE
  console.log('\n\n📋 ANALYSE COMPARATIVE - Positions simultanées possibles');
  console.log('='.repeat(80));
  
  const symbols = ['US500', 'EURUSD', 'XAUUSD', 'BTCUSD'];
  const estimates = [];
  
  for (const symbol of symbols) {
    const estimation = calculator.estimateMaxPositions(
      testConfig.balance, 
      testConfig.freeMargin, 
      symbol, 
      20, // 20 points/pips distance typique
      1.0  // 1% risque
    );
    estimates.push({ symbol, ...estimation });
  }
  
  estimates.sort((a, b) => b.maxPositions - a.maxPositions);
  
  console.log('\nClassement par capacité de positions simultanées:');
  estimates.forEach((est, index) => {
    console.log(`${index + 1}. ${est.symbol.padEnd(8)} : ${est.maxPositions.toString().padStart(2)} positions (marge: $${est.marginPerPosition})`);
  });

  // 6. RECOMMANDATIONS FTMO
  console.log('\n\n💡 RECOMMANDATIONS FTMO SWING');
  console.log('='.repeat(80));
  console.log('✅ PRIVILÉGIER : US500, NAS100 (coûts faibles, bon levier, multi-positions)');
  console.log('⚠️  MODÉRER : EURUSD, XAUUSD (marge importante, coûts moyens)');
  console.log('❌ ÉVITER : BTCUSD (commissions prohibitives pour swing intraday)');
  console.log('\nPour 1% de risque avec 10k$ :');
  console.log('- US500 : ~5-10 positions simultanées possibles');
  console.log('- EURUSD : ~1-2 positions simultanées max');
  console.log('- XAUUSD : ~2-3 positions simultanées max');
  console.log('- BTCUSD : Position déconseillée (coûts > 30% du risque)');

  console.log('\n✅ Tests terminés');
}

// Lancer le test
if (require.main === module) {
  testAllSymbols().catch(console.error);
}

module.exports = { testAllSymbols };