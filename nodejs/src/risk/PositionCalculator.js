// nodejs/src/risk/PositionCalculator.js
class PositionCalculator {
  constructor() {
    // Spécifications FTMO basées sur vos tests réels
    this.symbolSpecs = {
      // FOREX - Levier 30:1
      'EURUSD': {
        pipValue: 10,           // 10$ par lot pour 1 pip
        contractSize: 100000,
        leverage: 30,
        minLot: 0.01,
        maxLot: 50,
        lotStep: 0.01,
        spreadPips: 0.4,        // 0.4 pips spread
        commissionPerLot: 3.0   // 3$ aller-retour par lot
      },
      'GBPUSD': {
        pipValue: 10,
        contractSize: 100000,
        leverage: 30,
        minLot: 0.01,
        maxLot: 50,
        lotStep: 0.01,
        spreadPips: 1.0,
        commissionPerLot: 3.0
      },
      'USDJPY': {
        pipValue: 10,           // Corrigé: 10$ par lot pour 1 pip (pas 1000)
        contractSize: 100000,
        leverage: 30,
        minLot: 0.01,
        maxLot: 50,
        lotStep: 0.01,
        spreadPips: 1.2,
        commissionPerLot: 3.0
      },
      
      // INDICES - Levier 15:1
      'US500.cash': {
        pipValue: 1,            // 1$ par lot pour 1 point
        contractSize: 1,
        leverage: 15,
        minLot: 0.01,
        maxLot: 50,
        lotStep: 0.01,
        spreadPips: 0.56,
        commissionPerLot: 0.0
      },
      'NAS100': {
        pipValue: 1,
        contractSize: 1,
        leverage: 15,
        minLot: 0.01,
        maxLot: 50,
        lotStep: 0.01,
        spreadPips: 1.90,
        commissionPerLot: 0.0
      },
      
      // MÉTAUX - Levier 9:1
      'XAUUSD': {
        pipValue: 10,           // 10$ par lot pour 1$ de mouvement
        contractSize: 100,
        leverage: 9,
        minLot: 0.01,
        maxLot: 0.50,           // Limité selon vos tests
        lotStep: 0.01,
        spreadPips: 2.1,
        commissionPerLot: 7.37
      },
      
      // CRYPTOS - Levier 1:1
      'BTCUSD': {
        pipValue: 1,            // 1$ par lot pour 1$ de mouvement
        contractSize: 1,
        leverage: 1,
        minLot: 0.01,
        maxLot: 0.08,           // Testé et confirmé
        lotStep: 0.01,
        spreadPips: 1.0,
        commissionPerLot: 150.36
      }
    };
  }

  /**
   * Calcule la taille de lot pour un risque exact de 1%
   * VERSION SIMPLIFIÉE ET CORRECTE
   */
  async calculateLotSize(params) {
    const {
      balance,
      freeMargin,
      symbol,
      stopLoss,
      entryPrice,
      riskPercent,
      maxLotSize
    } = params;

    console.log('[PositionCalculator] FTMO Simple - Calcul pour:', {
      symbol,
      balance,
      freeMargin,
      entryPrice,
      stopLoss,
      riskPercent: riskPercent + '%'
    });

    // Validation
    if (!stopLoss || !entryPrice || stopLoss === entryPrice) {
      throw new Error('Stop loss invalide');
    }

    const specs = this.getSymbolSpecs(symbol);
    if (!specs) {
      throw new Error(`Symbole ${symbol} non supporté`);
    }

    // 1. Calculer le risque cible en dollars
    const targetRiskDollars = balance * (riskPercent / 100);

    // 2. Calculer la distance du stop loss
    const stopDistance = Math.abs(entryPrice - stopLoss);

    // 3. Calculer le lot final directement
const riskPerLot = stopDistance * specs.pipValue;
const costsPerLot = specs.spreadPips * specs.pipValue + specs.commissionPerLot;
const totalCostPerLot = riskPerLot + costsPerLot;

let optimalLot = targetRiskDollars / totalCostPerLot;

   /* // 3. Calculer le lot optimal pour le risque (SANS les coûts d'abord)
    const riskPerLot = stopDistance * specs.pipValue;
    let optimalLot = targetRiskDollars / riskPerLot;

    // 4. Calculer les coûts pour ce lot
    const transactionCosts = this.calculateTransactionCosts(optimalLot, specs);
    
    // 5. Ajuster le lot pour que risque + coûts = target
    const netTargetRisk = targetRiskDollars - transactionCosts;
    if (netTargetRisk <= 0) {
      throw new Error('Coûts de transaction dépassent le budget de risque');
    }
    
    optimalLot = netTargetRisk / riskPerLot;*/

    // 6. Vérifier les limites
    const limits = this.checkLimits(optimalLot, specs, entryPrice, freeMargin, maxLotSize);
    const finalLot = Math.min(optimalLot, limits.maxByMargin, limits.maxByStrategy, limits.maxByBroker);

    // 7. Arrondir selon les spécifications
    const roundedLot = this.roundToLotStep(finalLot, specs);
    const validLot = Math.max(roundedLot, specs.minLot);

    // 8. Calculer les métriques finales
    const result = this.calculateFinalMetrics(validLot, specs, entryPrice, stopDistance, balance, limits);

    console.log('[PositionCalculator] FTMO Résultat:', {
      lotCalculated: validLot,
      riskNet: result.riskAmount,
      marginUsed: result.marginUsed,
      limitedBy: result.limitedBy
    });

    return result;
  }

  /**
   * Calcule les coûts de transaction total
   */
  calculateTransactionCosts(lotSize, specs) {
    const spreadCost = specs.spreadPips * specs.pipValue * lotSize;
    const commissionCost = specs.commissionPerLot * lotSize; // Aller-retour
    return spreadCost + commissionCost;
  }

  /**
   * Vérifie toutes les limites
   */
  checkLimits(optimalLot, specs, entryPrice, freeMargin, maxLotSize) {
    // Limite par marge disponible
    let maxByMargin = specs.maxLot;
    if (freeMargin && freeMargin > 0) {
      const marginPerLot = (entryPrice * specs.contractSize) / specs.leverage;
      maxByMargin = (freeMargin * 0.9) / marginPerLot; // 10% sécurité
    }

    return {
      maxByMargin,
      maxByStrategy: maxLotSize,
      maxByBroker: specs.maxLot,
      marginPerLot: (entryPrice * specs.contractSize) / specs.leverage
    };
  }

  /**
   * Calcule les métriques finales
   */
  calculateFinalMetrics(lotSize, specs, entryPrice, stopDistance, balance, limits) {
    // Risque réel
    const grossRisk = lotSize * stopDistance * specs.pipValue;
    const transactionCosts = this.calculateTransactionCosts(lotSize, specs);
    const netRisk = grossRisk + transactionCosts;
    const riskPercent = (netRisk / balance) * 100;

    // Marge utilisée
    const positionValue = lotSize * entryPrice * specs.contractSize;
    const marginUsed = positionValue / specs.leverage;

    // Facteur limitant
    const limitingFactor = this.identifyLimitingFactor(lotSize, limits);

    return {
      // Compatibilité avec votre code existant
      lotSize: parseFloat(lotSize.toFixed(2)),
      riskAmount: parseFloat(netRisk.toFixed(2)),
      pipDistance: stopDistance,
      riskRewardRatio: null, // Calculé ailleurs si nécessaire
      
      // Métriques FTMO
      riskPercent: parseFloat(riskPercent.toFixed(2)),
      marginUsed: parseFloat(marginUsed.toFixed(2)),
      leverage: specs.leverage,
      positionValue: parseFloat(positionValue.toFixed(2)),
      limitedBy: limitingFactor,
      
      // Détail des coûts
      transactionCosts: parseFloat(transactionCosts.toFixed(2)),
      grossRisk: parseFloat(grossRisk.toFixed(2)),
      spreadCost: parseFloat((specs.spreadPips * specs.pipValue * lotSize).toFixed(2)),
      commissionCost: parseFloat((specs.commissionPerLot * lotSize * 2).toFixed(2))
    };
  }

  /**
   * Identifie le facteur limitant
   */
  identifyLimitingFactor(finalLot, limits) {
    const tolerance = 0.01;
    
    if (Math.abs(finalLot - limits.maxByMargin) < tolerance) return 'margin';
    if (Math.abs(finalLot - limits.maxByStrategy) < tolerance) return 'strategy';
    if (Math.abs(finalLot - limits.maxByBroker) < tolerance) return 'broker';
    return 'risk';
  }

  /**
   * Utilitaires
   */
  getSymbolSpecs(symbol) {
    return this.symbolSpecs[symbol] || null;
  }

  roundToLotStep(lotSize, specs) {
    const steps = Math.floor(lotSize / specs.lotStep);
    return Math.max(steps * specs.lotStep, 0);
  }

  // Méthodes legacy pour compatibilité
  getPipValue(symbol) {
    const specs = this.getSymbolSpecs(symbol);
    return specs ? specs.pipValue : 10;
  }

  async applyKellyCriterion(baseLot, symbol) {
    return baseLot * 0.8;
  }

  calculateRiskReward(entry, stopLoss, takeProfit) {
    if (!takeProfit) return null;
    const riskDistance = Math.abs(entry - stopLoss);
    const rewardDistance = Math.abs(takeProfit - entry);
    return rewardDistance / riskDistance;
  }

  canOpenPosition(symbol, lotSize, entryPrice, freeMargin) {
    const specs = this.getSymbolSpecs(symbol);
    if (!specs) return false;
    
    const marginRequired = (lotSize * entryPrice * specs.contractSize) / specs.leverage;
    return marginRequired <= freeMargin * 0.9;
  }

  calculateMarginRequirement(symbol, lotSize, entryPrice) {
    const specs = this.getSymbolSpecs(symbol);
    if (!specs) return 0;
    
    return (lotSize * entryPrice * specs.contractSize) / specs.leverage;
  }

  /**
   * Nouvelle méthode : Estime les positions simultanées (corrigée)
   */
  estimateMaxPositions(balance, freeMargin, symbol, stopDistanceTypical, riskPercent = 1.0) {
    const specs = this.getSymbolSpecs(symbol);
    if (!specs) return { maxPositions: 0, error: 'Symbole non supporté' };

    // Prix typique par symbole
    const typicalPrices = {
      'EURUSD': 1.10, 'GBPUSD': 1.25, 'USDJPY': 150,
      'XAUUSD': 2000, 'BTCUSD': 60000,
      'US500': 4500, 'NAS100': 16000
    };
    
    const price = typicalPrices[symbol] || 1.0;
    const riskPerTrade = balance * (riskPercent / 100);
    const riskPerLot = stopDistanceTypical * specs.pipValue;
    const lotSizeTypical = riskPerTrade / riskPerLot;
    
    // Marge par position
    const marginPerPosition = (lotSizeTypical * price * specs.contractSize) / specs.leverage;
    const maxByMargin = Math.floor(freeMargin / marginPerPosition);
    
    return {
      maxPositions: maxByMargin,
      marginPerPosition: parseFloat(marginPerPosition.toFixed(2)),
      lotSizeUsed: parseFloat(lotSizeTypical.toFixed(2)),
      typicalPrice: price
    };
  }
}

module.exports = PositionCalculator;