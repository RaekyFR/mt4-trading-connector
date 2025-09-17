// nodejs/test-your-setup.js
const PositionCalculator = require('./src/risk/PositionCalculator');
const LeverageManager = require('./src/utils/LeverageManager');

async function testYourConfiguration() {
  console.log('🧪 Test de votre configuration - Levier 30\n');
  
  const calculator = new PositionCalculator();
  const leverageManager = new LeverageManager(calculator);
  
  // Configuration de test
  const accountState = {
    balance: 10000,    // 10k USD
    freeMargin: 8000   // 8k USD de marge libre
  };
  
  // Tests pour tous vos symboles avec des prix réalistes
  const testSignals = [
    {
      name: 'BTCUSD Long',
      symbol: 'BTCUSD',
      entryPrice: 58500,
      stopLoss: 57000,
      riskPercent: 2.0
    },
    {
      name: 'EURUSD Long', 
      symbol: 'EURUSD',
      entryPrice: 1.1000,
      stopLoss: 1.0950,
      riskPercent: 2.0
    },
    {
      name: 'NASDAQ Short',
      symbol: 'NAS100',
      entryPrice: 16000,
      stopLoss: 16200,
      riskPercent: 2.0
    },
    {
      name: 'S&P500 Long',
      symbol: 'US500', 
      entryPrice: 4500,
      stopLoss: 4450,
      riskPercent: 2.0
    },
    {
      name: 'Gold Long',
      symbol: 'XAUUSD',
      entryPrice: 2000,
      stopLoss: 1980,
      riskPercent: 2.0
    }
  ];
  
  console.log('📊 Configuration actuelle du levier:');
  const leverageConfig = leverageManager.getCurrentLeverageConfig();
  console.log(`Levier: ${leverageConfig.leverage}:1`);
  console.log(`Marge requise: ${leverageConfig.marginPercent}%`);
  console.log(`Niveau de risque: ${leverageConfig.riskLevel}\n`);
  
  // Tester chaque symbole
  for (const signal of testSignals) {
    console.log(`🎯 Test: ${signal.name}`);
    console.log(`Prix: ${signal.entryPrice} | SL: ${signal.stopLoss} | Risque: ${signal.riskPercent}%`);
    
    try {
      const result = await calculator.calculateLotSize({
        balance: accountState.balance,
        freeMargin: accountState.freeMargin,
        symbol: signal.symbol,
        entryPrice: signal.entryPrice,
        stopLoss: signal.stopLoss,
        riskPercent: signal.riskPercent,
        maxLotSize: 10.0
      });
      
      console.log(`✅ Lot: ${result.lotSize} | Risque: $${result.riskAmount} | Marge: $${result.marginUsed} | Limité par: ${result.limitedBy}`);
      
      // Vérifier si la position peut être ouverte
      const canOpen = calculator.canOpenPosition(
        signal.symbol, 
        result.lotSize, 
        signal.entryPrice, 
        accountState.freeMargin
      );
      
      console.log(`Position ouvrable: ${canOpen ? '✅' : '❌'}`);
      
    } catch (error) {
      console.log(`❌ Erreur: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Test de changement de levier
  console.log('=' .repeat(60));
  console.log('🔧 Test de simulation de changement de levier\n');
  
  const leverageTests = [20, 50, 100];
  
  for (const newLeverage of leverageTests) {
    console.log(`📈 Simulation levier ${newLeverage}:1`);
    const simulation = leverageManager.simulateLeverageChange(newLeverage);
    
    console.log(`Marge actuelle (${calculator.defaultLeverage}:1): $${simulation.currentLeverage.marginRequired}`);
    console.log(`Marge nouveau (${newLeverage}:1): $${simulation.newLeverage.marginRequired}`);
    console.log(`Économie: $${simulation.improvement.marginSavings}`);
    console.log(`Capacité supplémentaire: ${simulation.improvement.capacityIncrease}\n`);
  }
  
  // Test des limites de marge
  console.log('=' .repeat(60));
  console.log('⚠️  Test des limites de marge\n');
  
  const limitTest = {
    balance: 10000,
    freeMargin: 500, // Marge très limitée
    symbol: 'BTCUSD',
    entryPrice: 58500,
    stopLoss: 57000,
    riskPercent: 2.0,
    maxLotSize: 10.0
  };
  
  const limitResult = await calculator.calculateLotSize(limitTest);
  console.log('🔴 Test avec marge limitée ($500):');
  console.log(`Lot calculé: ${limitResult.lotSize}`);
  console.log(`Marge utilisée: $${limitResult.marginUsed}`);
  console.log(`Limité par: ${limitResult.limitedBy}`);
  console.log(`% de la marge libre: ${(limitResult.marginUsed / limitTest.freeMargin * 100).toFixed(1)}%`);
  
  console.log('\n✅ Tests de configuration terminés');
}

// Test spécifique pour vérifier la cohérence des calculs
async function testCalculationCoherence() {
  console.log('\n🔍 Test de cohérence des calculs\n');
  
  const calculator = new PositionCalculator();
  
  // Test avec BTCUSD
  const testParams = {
    balance: 10000,
    freeMargin: 5000,
    symbol: 'BTCUSD',
    entryPrice: 60000,
    stopLoss: 58500,
    riskPercent: 2.0,
    maxLotSize: 1.0
  };
  
  const result = await calculator.calculateLotSize(testParams);
  
  // Vérifications manuelles
  const specs = calculator.getSymbolSpecs('BTCUSD');
  const pipDistance = Math.abs(testParams.entryPrice - testParams.stopLoss);
  const expectedRisk = testParams.balance * (testParams.riskPercent / 100);
  const expectedLotFromRisk = expectedRisk / (pipDistance * specs.pipValue);
  
  const positionValue = result.lotSize * testParams.entryPrice * specs.contractSize;
  const calculatedMargin = positionValue / specs.leverage;
  
  console.log('📊 Vérification manuelle des calculs:');
  console.log(`Distance SL: ${pipDistance} (${pipDistance * specs.pipValue} points)`);
  console.log(`Risque autorisé: $${expectedRisk}`);
  console.log(`Lot basé sur risque: ${expectedLotFromRisk.toFixed(4)}`);
  console.log(`Lot final retenu: ${result.lotSize}`);
  console.log(`Valeur position: $${positionValue.toFixed(2)}`);
  console.log(`Marge calculée: $${calculatedMargin.toFixed(2)}`);
  console.log(`Marge retournée: $${result.marginUsed}`);
  console.log(`Levier effectif: ${(positionValue / result.marginUsed).toFixed(1)}:1`);
  
  // Cohérence
  const marginMatch = Math.abs(calculatedMargin - result.marginUsed) < 0.01;
  console.log(`✅ Cohérence marge: ${marginMatch ? 'OK' : 'ERREUR'}`);
}

// Exécuter tous les tests
async function runAllTests() {
  try {
    await testYourConfiguration();
    await testCalculationCoherence();
  } catch (error) {
    console.error('❌ Erreur dans les tests:', error);
  }
}

// Test de performance avec plusieurs positions simultanées
async function testMultiplePositions() {
  console.log('\n🎯 Test positions multiples avec levier 30\n');
  
  const calculator = new PositionCalculator();
  const accountState = {
    balance: 50000,    // Compte plus important
    freeMargin: 40000  // Marge libre confortable
  };
  
  const positions = [
    { symbol: 'BTCUSD', entryPrice: 58500, stopLoss: 57000, riskPercent: 1.5 },
    { symbol: 'EURUSD', entryPrice: 1.1000, stopLoss: 1.0950, riskPercent: 1.5 },
    { symbol: 'NAS100', entryPrice: 16000, stopLoss: 15800, riskPercent: 1.5 },
    { symbol: 'US500', entryPrice: 4500, stopLoss: 4460, riskPercent: 1.5 },
    { symbol: 'XAUUSD', entryPrice: 2000, stopLoss: 1985, riskPercent: 1.5 }
  ];
  
  let totalMarginUsed = 0;
  let totalRisk = 0;
  const results = [];
  
  console.log('Simulation de 5 positions simultanées:');
  console.log('Compte: $50,000 | Marge libre: $40,000 | Risque par trade: 1.5%\n');
  
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const availableMargin = accountState.freeMargin - totalMarginUsed;
    
    const result = await calculator.calculateLotSize({
      balance: accountState.balance,
      freeMargin: availableMargin,
      symbol: pos.symbol,
      entryPrice: pos.entryPrice,
      stopLoss: pos.stopLoss,
      riskPercent: pos.riskPercent,
      maxLotSize: 10.0
    });
    
    results.push({ ...pos, ...result });
    totalMarginUsed += result.marginUsed;
    totalRisk += result.riskAmount;
    
    console.log(`Position ${i+1} - ${pos.symbol}:`);
    console.log(`  Lot: ${result.lotSize} | Marge: ${result.marginUsed} | Risque: ${result.riskAmount}`);
    console.log(`  Marge restante: ${(availableMargin - result.marginUsed).toFixed(2)}`);
  }
  
  console.log('\n📊 Résumé global:');
  console.log(`Total marge utilisée: ${totalMarginUsed.toFixed(2)} (${(totalMarginUsed/accountState.freeMargin*100).toFixed(1)}%)`);
  console.log(`Total risque: ${totalRisk.toFixed(2)} (${(totalRisk/accountState.balance*100).toFixed(1)}%)`);
  console.log(`Marge libre restante: ${(accountState.freeMargin - totalMarginUsed).toFixed(2)}`);
  
  return results;
}

// Test de comparaison avec différents leviers
async function compareLeverageImpact() {
  console.log('\n📈 Comparaison impact des différents leviers\n');
  
  const leverages = [20, 30, 50, 100];
  const testPosition = {
    symbol: 'BTCUSD',
    entryPrice: 60000,
    lotSize: 0.1,
    balance: 10000
  };
  
  console.log(`Test avec ${testPosition.symbol} - ${testPosition.lotSize} lot à ${testPosition.entryPrice}`);
  console.log('Compte: $10,000\n');
  
  const specs = {
    contractSize: 1,
    pipValue: 1
  };
  
  leverages.forEach(leverage => {
    const positionValue = testPosition.lotSize * testPosition.entryPrice * specs.contractSize;
    const marginRequired = positionValue / leverage;
    const marginPercent = (marginRequired / testPosition.balance) * 100;
    const maxPositions = Math.floor(testPosition.balance / marginRequired);
    
    console.log(`Levier ${leverage}:1`);
    console.log(`  Marge requise: ${marginRequired.toFixed(2)} (${marginPercent.toFixed(1)}% du compte)`);
    console.log(`  Positions max possibles: ${maxPositions}`);
    console.log(`  Utilisation marge pour 1 position: ${marginPercent.toFixed(1)}%\n`);
  });
}

// Lancer les tests si ce fichier est exécuté directement
if (require.main === module) {
  console.log('🚀 Démarrage des tests - Configuration avec levier 30:1\n');
  runAllTests()
    .then(() => testMultiplePositions())
    .then(() => compareLeverageImpact())
    .then(() => console.log('\n✅ Tous les tests terminés avec succès'))
    .catch(error => console.error('❌ Erreur:', error));
}

module.exports = { 
  testYourConfiguration, 
  testCalculationCoherence, 
  testMultiplePositions,
  compareLeverageImpact 
};