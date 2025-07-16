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

// module.exports = { PositionCalculator, RiskValidator};
module.exports = PositionCalculator;
