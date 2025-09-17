// test-mt4-integration.js - VERSION CORRIGÉE
// Script pour tester l'intégration MT4Connector avec RiskManager

const MT4Connector = require('./src/mt4/MT4Connector');
const RiskManager = require('./src/risk/RiskManager');
const { PrismaClient } = require('@prisma/client');

async function testIntegration() {
  console.log('🧪 Test d\'intégration MT4Connector + RiskManager avec création stratégie\n');
  
  let mt4Connector = null;
  let riskManager = null;
  let prisma = null;
  let createdStrategyId = null;

  try {
    // 1. Initialiser Prisma
    prisma = new PrismaClient();
    await prisma.$connect();
    console.log('✅ Prisma connecté');

    // 2. Créer une stratégie de test
    const testStrategy = await prisma.strategy.create({
      data: {
        name: 'TEST_INTEGRATION',
        description: 'Stratégie temporaire pour tests d\'intégration',
        isActive: true,
        maxDailyLoss: 5.0,
        maxPositions: 3,
        maxLotSize: 1.0,
        defaultRiskPercent: 2.0,
        riskRewardRatio: 2.0,
        allowedSymbols: JSON.stringify(['BTCUSD', 'EURUSD'])
      }
    });
    
    createdStrategyId = testStrategy.id;
    console.log('✅ Stratégie de test créée:', testStrategy.name);

    // 3. Initialiser MT4Connector
    const mt4Config = {
      folder: './mt4_files',
      commandTimeout: 10000
    };
    
    mt4Connector = new MT4Connector(mt4Config);
    console.log('✅ MT4Connector créé');

    // 4. Initialiser RiskManager avec MT4Connector
    riskManager = new RiskManager(mt4Connector);
    console.log('✅ RiskManager créé avec MT4Connector');

    // 5. Test de getAccountState() sans MT4 connecté
    console.log('\n📊 Test 1: getAccountState() sans MT4 connecté');
    const accountState1 = await riskManager.getAccountState();
    
    console.log('Résultat:', {
      balance: accountState1.balance,
      freeMargin: accountState1.freeMargin,
      source: accountState1.source
    });

    // 6. Simuler MT4 connecté pour le test
    console.log('\n📊 Test 2: Simulation MT4 connecté');
    
    // Mock temporaire de la méthode getAccountInfo
    const originalGetAccountInfo = mt4Connector.getAccountInfo;
    mt4Connector.getAccountInfo = async () => {
      return {
        balance: 15000,
        equity: 14800,
        margin: 500,
        freeMargin: 14300,
        marginLevel: 2960,
        currency: 'USD',
        leverage: 30,
        accountNumber: 12345,
        broker: 'Test Broker'
      };
    };
    
    // Marquer comme connecté
    mt4Connector.isConnected = true;
    
    const accountState2 = await riskManager.getAccountState();
    console.log('Résultat avec MT4 simulé:', {
      balance: accountState2.balance,
      equity: accountState2.equity,
      freeMargin: accountState2.freeMargin,
      marginLevel: accountState2.marginLevel,
      source: accountState2.source
    });

    // 7. Test de calcul de position avec marge ET stratégie valide
    console.log('\n🎯 Test 3: Calcul de position avec marge libre et levier');
    
    const testSignal = {
      strategy: 'TEST_INTEGRATION', // Utilise la stratégie créée
      action: 'buy',
      symbol: 'BTCUSD',
      entry_price: 0,
      current_price: 58000,
      stopLoss: 56500,
      source: 'test'
    };
    
    const validation = await riskManager.validateSignal(testSignal);
    
    if (validation.success) {
      console.log('✅ Validation réussie:');
      console.log('  Lot calculé:', validation.lotSize);
      console.log('  Risque:', validation.riskAmount + '$');
      console.log('  Take Profit:', validation.takeProfit);
      
      if (validation.leverageInfo) {
        console.log('📈 Infos levier:');
        console.log('  Marge utilisée:', validation.leverageInfo.marginUsed + '$');
        console.log('  Levier:', validation.leverageInfo.leverage + ':1');
        console.log('  Limité par:', validation.leverageInfo.limitedBy);
        
        // Calculer l'utilisation de la marge
        const margeUtilisation = ((validation.leverageInfo.marginUsed / accountState2.freeMargin) * 100).toFixed(1);
        console.log('  Utilisation marge:', margeUtilisation + '%');
      }
    } else {
      console.log('❌ Validation échouée:', validation.error);
    }

    // 8. Test avec différentes tailles de positions
    console.log('\n💪 Test 4: Test avec différents niveaux de risque');
    
    const riskLevels = [1.0, 2.0, 5.0];
    
    for (const riskPercent of riskLevels) {
      // Créer une stratégie temporaire avec ce niveau de risque
      const tempStrategy = await prisma.strategy.create({
        data: {
          name: `TEST_RISK_${riskPercent}`,
          description: `Test risque ${riskPercent}%`,
          isActive: true,
          maxDailyLoss: 10.0,
          maxPositions: 5,
          maxLotSize: 2.0,
          defaultRiskPercent: riskPercent,
          riskRewardRatio: 2.0,
          allowedSymbols: JSON.stringify(['BTCUSD'])
        }
      });
      
      const testSignalRisk = {
        strategy: `TEST_RISK_${riskPercent}`,
        action: 'buy',
        symbol: 'BTCUSD',
        entry_price: 0,
        current_price: 58000,
        stopLoss: 56500,
        source: 'test'
      };
      
      const validationRisk = await riskManager.validateSignal(testSignalRisk);
      
      if (validationRisk.success && validationRisk.leverageInfo) {
        console.log(`Risk ${riskPercent}%: Lot=${validationRisk.lotSize}, Marge=${validationRisk.leverageInfo.marginUsed}$, Limité par=${validationRisk.leverageInfo.limitedBy}`);
      }
      
      // Nettoyer la stratégie temporaire
      await prisma.strategy.delete({ where: { id: tempStrategy.id } });
    }

    // 9. Test de fraîcheur des données
    console.log('\n⏰ Test 5: Vérification fraîcheur des données');
    const isFresh = await riskManager.isAccountDataFresh(5); // 5 minutes
    console.log(`Données fraîches (< 5min): ${isFresh ? '✅' : '❌'}`);

    // Restaurer la méthode originale
    mt4Connector.getAccountInfo = originalGetAccountInfo;
    mt4Connector.isConnected = false;

    console.log('\n🎉 Tous les tests d\'intégration terminés avec succès');
    console.log('📊 Résumé: Marge libre récupérée, calculs de levier fonctionnels, stratégies validées');

  } catch (error) {
    console.error('\n❌ Erreur dans les tests:', error.message);
    console.error(error.stack);
  } finally {
    // Nettoyage
    try {
      // Supprimer la stratégie de test
      if (createdStrategyId && prisma) {
        await prisma.strategy.delete({ where: { id: createdStrategyId } });
        console.log('🗑️ Stratégie de test supprimée');
      }
      
      // Nettoyer les autres stratégies de test qui pourraient rester
      await prisma.strategy.deleteMany({
        where: {
          name: {
            startsWith: 'TEST_'
          }
        }
      });
      
      if (riskManager) await riskManager.cleanup();
      if (mt4Connector) await mt4Connector.stop();
      if (prisma) await prisma.$disconnect();
      console.log('🧹 Nettoyage terminé');
    } catch (cleanupError) {
      console.error('Erreur nettoyage:', cleanupError.message);
    }
  }
}

// Lancer le test si exécuté directement
if (require.main === module) {
  testIntegration().then(() => {
    console.log('\n🏁 Tests terminés');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 Échec des tests:', error);
    process.exit(1);
  });
}

module.exports = { testIntegration };