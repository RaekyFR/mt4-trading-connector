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

//module.exports = { PositionCalculator, RiskValidator, CorrelationAnalyzer };
module.exports = CorrelationAnalyzer;