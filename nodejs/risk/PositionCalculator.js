// nodejs/src/risk/PositionCalculator.js
class PositionCalculator {
  constructor() {
    // Valeurs pip par symbole (à étendre selon les besoins)
    this.pipValues = {
      'EURUSD': 10,
      'GBPUSD': 10,
      'USDJPY': 1000,
      'XAUUSD': 10,
      'BTCUSD': 1,
      // Ajouter d'autres paires selon les besoins
    };
  }

  /**
   * Calcule la taille de lot optimale selon les paramètres de risk
   */
  async calculateLotSize(params) {
    const {
      balance,
      symbol,
      stopLoss,
      entryPrice,
      riskPercent,
      maxLotSize,
      useKelly = false
    } = params;

    // Validation des paramètres
    if (!stopLoss || !entryPrice || stopLoss === entryPrice) {
      throw new Error('Stop loss invalide');
    }

    // Calculer la distance en pips
    const pipDistance = Math.abs(entryPrice - stopLoss);
    const pipValue = this.getPipValue(symbol);
    const pointsDistance = pipDistance * pipValue;

    // Montant à risquer
    const riskAmount = balance * (riskPercent / 100);

    // Calcul du lot de base
    let lotSize = riskAmount / pointsDistance;

    // Appliquer Kelly Criterion si demandé
    if (useKelly) {
      lotSize = await this.applyKellyCriterion(lotSize, symbol);
    }

    // Arrondir à 2 décimales
    lotSize = Math.round(lotSize * 100) / 100;

    // Respecter les limites
    lotSize = Math.min(lotSize, maxLotSize);
    lotSize = Math.max(lotSize, 0.01); // Lot minimum

    return {
      lotSize,
      riskAmount,
      pipDistance,
      riskRewardRatio: this.calculateRiskReward(entryPrice, stopLoss, params.takeProfit)
    };
  }

  /**
   * Récupère la valeur du pip pour un symbole
   */
  getPipValue(symbol) {
    return this.pipValues[symbol] || 10;
  }

  /**
   * Applique le Kelly Criterion pour optimiser la taille
   */
  async applyKellyCriterion(baseLot, symbol) {
    // TODO: Implémenter le calcul basé sur l'historique des trades
    // Pour l'instant, on applique un facteur conservateur
    return baseLot * 0.8;
  }

  /**
   * Calcule le ratio risk/reward
   */
  calculateRiskReward(entry, stopLoss, takeProfit) {
    if (!takeProfit) return null;

    const riskDistance = Math.abs(entry - stopLoss);
    const rewardDistance = Math.abs(takeProfit - entry);

    return rewardDistance / riskDistance;
  }
}

// ========================================

// nodejs/src/risk/RiskValidator.js
class RiskValidator {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Vérifie les limites globales du compte
   */
  async checkGlobalLimits(riskConfig) {
    // Vérifier la perte quotidienne
    const dailyPnL = await this.getDailyPnL();
    const accountState = await this.getLatestAccountState();
    const dailyLossPercent = (dailyPnL / accountState.balance) * 100;

    if (dailyLossPercent <= -riskConfig.maxDailyLoss) {
      return {
        passed: false,
        reason: `Perte quotidienne maximale atteinte: ${dailyLossPercent.toFixed(2)}%`
      };
    }

    // Vérifier le nombre total de positions
    const openPositions = await this.prisma.order.count({
      where: { status: { in: ['PLACED', 'FILLED', 'PARTIAL'] } }
    });

    if (openPositions >= riskConfig.maxTotalPositions) {
      return {
        passed: false,
        reason: `Nombre maximum de positions atteint: ${openPositions}/${riskConfig.maxTotalPositions}`
      };
    }

    // Vérifier l'exposition totale
    const totalExposure = await this.prisma.order.aggregate({
      where: { status: { in: ['PLACED', 'FILLED', 'PARTIAL'] } },
      _sum: { lots: true }
    });

    if ((totalExposure._sum.lots || 0) >= riskConfig.maxTotalExposure) {
      return {
        passed: false,
        reason: `Exposition totale maximale atteinte: ${totalExposure._sum.lots}/${riskConfig.maxTotalExposure} lots`
      };
    }

    // Vérifier le drawdown
    const drawdown = await this.calculateDrawdown();
    if (drawdown >= riskConfig.maxDrawdown) {
      return {
        passed: false,
        reason: `Drawdown maximum atteint: ${drawdown.toFixed(2)}%`
      };
    }

    return { passed: true };
  }

  /**
   * Vérifie les limites spécifiques à un symbole
   */
  async checkSymbolLimits(symbol, riskConfig) {
    const symbolPositions = await this.prisma.order.count({
      where: {
        symbol,
        status: { in: ['PLACED', 'FILLED', 'PARTIAL'] }
      }
    });

    if (symbolPositions >= riskConfig.maxPositionsPerSymbol) {
      return {
        passed: false,
        reason: `Nombre max de positions pour ${symbol}: ${symbolPositions}/${riskConfig.maxPositionsPerSymbol}`
      };
    }

    return { passed: true };
  }

  /**
   * Vérifie la validité d'une taille de lot
   */
  async checkLotSize(lotSize, symbol, riskConfig) {
    if (lotSize > riskConfig.maxLotSize) {
      return {
        passed: false,
        reason: `Taille de lot trop élevée: ${lotSize} > ${riskConfig.maxLotSize}`
      };
    }

    if (lotSize < 0.01) {
      return {
        passed: false,
        reason: `Taille de lot trop faible: ${lotSize} < 0.01`
      };
    }

    return { passed: true };
  }

  /**
   * Calcule le P&L quotidien
   */
  async getDailyPnL() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await this.prisma.order.aggregate({
      where: {
        closeTime: { gte: startOfDay },
        status: 'CLOSED'
      },
      _sum: { profit: true }
    });

    return result._sum.profit || 0;
  }

  /**
   * Récupère le dernier état du compte
   */
  async getLatestAccountState() {
    return await this.prisma.accountState.findFirst({
      orderBy: { lastUpdate: 'desc' }
    }) || { balance: 10000, equity: 10000 }; // Valeurs par défaut
  }

  /**
   * Calcule le drawdown actuel
   */
  async calculateDrawdown() {
    // TODO: Implémenter le calcul du drawdown basé sur l'historique
    // Pour l'instant, retour d'une valeur fictive
    return 5.2;
  }
}

// ========================================

// nodejs/src/risk/CorrelationAnalyzer.js
class CorrelationAnalyzer {
  constructor() {
    // Matrice de corrélation simplifiée (à enrichir avec des données réelles)
    this.correlationMatrix = {
      'EURUSD': {
        'GBPUSD': 0.85,
        'USDCHF': -0.90,
        'USDJPY': -0.30,
        'EURJPY': 0.60
      },
      'GBPUSD': {
        'EURUSD': 0.85,
        'USDCHF': -0.75,
        'USDJPY': -0.25,
        'GBPJPY': 0.70
      },
      'XAUUSD': {
        'XAGUSD': 0.80,
        'USDCHF': -0.60,
        'USDJPY': -0.55
      },
      'BTCUSD': {
        'ETHUSD': 0.75,
        'XAUUSD': 0.20
      }
      // Ajouter d'autres corrélations selon les besoins
    };
  }

  /**
   * Vérifie si une nouvelle position peut être ouverte selon les corrélations
   */
  async checkNewPosition(symbol, maxCorrelation = 0.7) {
    const openPositions = await this.getOpenPositions();
    
    if (openPositions.length === 0) {
      return { blocked: false, data: {} };
    }

    const correlations = {};
    let highestCorrelation = 0;
    let mostCorrelatedPair = null;

    // Analyser les corrélations avec les positions existantes
    for (const position of openPositions) {
      const correlation = this.getCorrelation(symbol, position.symbol);
      
      if (correlation !== null) {
        correlations[position.symbol] = correlation;
        
        if (Math.abs(correlation) > Math.abs(highestCorrelation)) {
          highestCorrelation = correlation;
          mostCorrelatedPair = position.symbol;
        }
      }
    }

    // Vérifier si la corrélation dépasse le seuil
    if (Math.abs(highestCorrelation) > maxCorrelation) {
      return {
        blocked: true,
        reason: `Corrélation trop élevée avec ${mostCorrelatedPair}: ${(highestCorrelation * 100).toFixed(1)}%`,
        data: correlations
      };
    }

    // Analyser l'exposition directionnelle
    const directionalExposure = await this.analyzeDirectionalExposure(symbol, openPositions);
    if (directionalExposure.blocked) {
      return directionalExposure;
    }

    return {
      blocked: false,
      data: correlations
    };
  }

  /**
   * Récupère le coefficient de corrélation entre deux symboles
   */
  getCorrelation(symbol1, symbol2) {
    if (symbol1 === symbol2) return 1.0;

    // Vérifier dans la matrice
    if (this.correlationMatrix[symbol1] && this.correlationMatrix[symbol1][symbol2]) {
      return this.correlationMatrix[symbol1][symbol2];
    }
    
    if (this.correlationMatrix[symbol2] && this.correlationMatrix[symbol2][symbol1]) {
      return this.correlationMatrix[symbol2][symbol1];
    }

    return null; // Pas de données de corrélation
  }

  /**
   * Analyse l'exposition directionnelle totale
   */
  async analyzeDirectionalExposure(newSymbol, openPositions) {
    // Calculer l'exposition pondérée par les corrélations
    let totalLongExposure = 0;
    let totalShortExposure = 0;

    for (const position of openPositions) {
      const correlation = this.getCorrelation(newSymbol, position.symbol) || 0;
      const exposureWeight = position.lots * correlation;

      if (position.type === 'BUY') {
        totalLongExposure += exposureWeight;
      } else if (position.type === 'SELL') {
        totalShortExposure += Math.abs(exposureWeight);
      }
    }

    // Seuil d'exposition directionnelle (en lots pondérés)
    const maxDirectionalExposure = 3.0;

    if (totalLongExposure > maxDirectionalExposure) {
      return {
        blocked: true,
        reason: `Exposition long trop élevée: ${totalLongExposure.toFixed(2)} lots pondérés`,
        data: { totalLongExposure, totalShortExposure }
      };
    }

    if (totalShortExposure > maxDirectionalExposure) {
      return {
        blocked: true,
        reason: `Exposition short trop élevée: ${totalShortExposure.toFixed(2)} lots pondérés`,
        data: { totalLongExposure, totalShortExposure }
      };
    }

    return {
      blocked: false,
      data: { totalLongExposure, totalShortExposure }
    };
  }

  /**
   * Récupère les positions ouvertes (mock pour l'instant)
   */
  async getOpenPositions() {
    // TODO: Implémenter avec Prisma
    // return await this.prisma.order.findMany({
    //   where: { status: { in: ['PLACED', 'FILLED', 'PARTIAL'] } }
    // });
    
    // Mock pour les tests
    return [];
  }

  /**
   * Met à jour la matrice de corrélation avec des données historiques
   */
  async updateCorrelationMatrix(symbol1, symbol2, correlation) {
    if (!this.correlationMatrix[symbol1]) {
      this.correlationMatrix[symbol1] = {};
    }
    
    this.correlationMatrix[symbol1][symbol2] = correlation;
    
    // Maintenir la symétrie
    if (!this.correlationMatrix[symbol2]) {
      this.correlationMatrix[symbol2] = {};
    }
    
    this.correlationMatrix[symbol2][symbol1] = correlation;
  }
}

module.exports = { PositionCalculator, RiskValidator, CorrelationAnalyzer };