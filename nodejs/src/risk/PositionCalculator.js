// nodejs/src/risk/PositionCalculator.js
class PositionCalculator {
  constructor() {
    // Configuration des symboles avec spécifications complètes
    this.symbolSpecs = {
      'EURUSD': {
        pipValue: 10,
        contractSize: 100000,
        leverage: 30,
        marginPercent: 3.33,
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        pipSize: 0.0001
      },
      'GBPUSD': {
        pipValue: 10,
        contractSize: 100000,
        leverage: 30,
        marginPercent: 3.33,
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        pipSize: 0.0001
      },
      'USDJPY': {
        pipValue: 1000,
        contractSize: 100000,
        leverage: 30,
        marginPercent: 3.33,
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        pipSize: 0.01
      },
      'XAUUSD': {
        pipValue: 10,
        contractSize: 100,
        leverage: 30,
        marginPercent: 3.33,
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        pipSize: 0.01
      },
      'BTCUSD': {
        pipValue: 1,
        contractSize: 1,
        leverage: 30,
        marginPercent: 3.33,
        minLot: 0.01,
        maxLot: 10.0,
        lotStep: 0.01,
        pipSize: 1
      },
      // Nouveaux symboles demandés
      'NAS100': { // NASDAQ 100
        pipValue: 1,
        contractSize: 1,
        leverage: 30,
        marginPercent: 3.33,
        minLot: 0.01,
        maxLot: 10.0,
        lotStep: 0.01,
        pipSize: 1
      },
      'US500': { // S&P 500
        pipValue: 1,
        contractSize: 1,
        leverage: 30,
        marginPercent: 3.33,
        minLot: 0.01,
        maxLot: 10.0,
        lotStep: 0.01,
        pipSize: 1
      },
      'SPX500': { // Alternative pour S&P 500
        pipValue: 1,
        contractSize: 1,
        leverage: 30,
        marginPercent: 3.33,
        minLot: 0.01,
        maxLot: 10.0,
        lotStep: 0.01,
        pipSize: 1
      }
    };

    // Configuration du levier par défaut (peut être modifié)
    this.defaultLeverage = 30;
  }

  /**
   * Met à jour le levier pour tous les symboles
   * @param {number} newLeverage - Nouveau levier
   */
  updateLeverage(newLeverage) {
    console.log(`[PositionCalculator] Mise à jour levier: ${this.defaultLeverage} -> ${newLeverage}`);
    
    this.defaultLeverage = newLeverage;
    const newMarginPercent = 100 / newLeverage;
    
    // Mettre à jour tous les symboles
    Object.keys(this.symbolSpecs).forEach(symbol => {
      this.symbolSpecs[symbol].leverage = newLeverage;
      this.symbolSpecs[symbol].marginPercent = newMarginPercent;
    });
  }

  /**
   * Calcule la taille de lot optimale selon les paramètres de risk
   * VERSION MISE À JOUR avec gestion du levier
   */
  async calculateLotSize(params) {
    const {
      balance,
      freeMargin,
      symbol,
      stopLoss,
      entryPrice,
      riskPercent,
      maxLotSize,
      useKelly = false
    } = params;

    console.log('[PositionCalculator] Calcul avec params:', {
      balance,
      freeMargin: freeMargin || 'non fourni',
      symbol,
      entryPrice,
      stopLoss,
      riskPercent,
      maxLotSize
    });

    // Validation des paramètres
    if (!stopLoss || !entryPrice || stopLoss === entryPrice) {
      throw new Error('Stop loss invalide');
    }

    // Récupérer les spécifications du symbole
    const specs = this.getSymbolSpecs(symbol);

    // Calculer la distance en pips (votre logique existante)
    const pipDistance = Math.abs(entryPrice - stopLoss);
    const pipValue = specs.pipValue;
    const pointsDistance = pipDistance * pipValue;

    // Montant à risquer
    const riskAmount = balance * (riskPercent / 100);

    // Calcul du lot de base (votre logique existante)
    let riskBasedLotSize = riskAmount / pointsDistance;

    // NOUVEAU: Calcul de la limite basée sur la marge
    let marginBasedLotSize = specs.maxLot; // Par défaut
    
    if (freeMargin && freeMargin > 0) {
      const positionValue = entryPrice * specs.contractSize;
      const marginRequired = positionValue * (specs.marginPercent / 100);
      marginBasedLotSize = freeMargin / marginRequired;
      
      console.log('[PositionCalculator] Calcul marge:', {
        positionValue,
        marginRequired,
        maxLotsByMargin: marginBasedLotSize
      });
    }

    // Prendre le minimum entre les différentes limites
    let lotSize = Math.min(
      riskBasedLotSize,
      marginBasedLotSize,
      maxLotSize,
      specs.maxLot
    );

    // Appliquer Kelly Criterion si demandé
    if (useKelly) {
      lotSize = await this.applyKellyCriterion(lotSize, symbol);
    }

    // Arrondir selon les spécifications
    lotSize = this.roundToLotStep(lotSize, specs);

    // Respecter le lot minimum
    lotSize = Math.max(lotSize, specs.minLot);

    // Calculer les métriques finales
    const result = this.calculateFinalMetrics(
      lotSize, 
      entryPrice, 
      stopLoss, 
      balance, 
      specs,
      { risk: riskBasedLotSize, margin: marginBasedLotSize, strategy: maxLotSize },
      params.takeProfit
    );

    console.log('[PositionCalculator] Résultat final:', result);
    return result;
  }

  /**
   * Récupère les spécifications d'un symbole (avec fallback)
   */
  getSymbolSpecs(symbol) {
    const specs = this.symbolSpecs[symbol];
    if (!specs) {
      console.warn(`[PositionCalculator] Spécifications manquantes pour ${symbol}, utilisation des défauts`);
      return {
        pipValue: 10,
        contractSize: 100000,
        leverage: this.defaultLeverage,
        marginPercent: 100 / this.defaultLeverage,
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        pipSize: 0.0001
      };
    }
    return specs;
  }

  /**
   * Arrondit la taille de lot selon les spécifications
   */
  roundToLotStep(lotSize, specs) {
    const steps = Math.floor(lotSize / specs.lotStep);
    return Math.max(steps * specs.lotStep, 0);
  }

  /**
   * Calcule toutes les métriques finales
   */
  calculateFinalMetrics(lotSize, entryPrice, stopLoss, balance, specs, limits, takeProfit = null) {
    const pipDistance = Math.abs(entryPrice - stopLoss);
    const pointsDistance = pipDistance * specs.pipValue;
    const actualRiskAmount = lotSize * pointsDistance;
    const actualRiskPercent = (actualRiskAmount / balance) * 100;

    // Calculs du levier
    const positionValue = lotSize * entryPrice * specs.contractSize;
    const marginUsed = positionValue / specs.leverage;

    // Identifier le facteur limitant
    const limitingFactor = this.getLimitingFactor(limits, lotSize);

    return {
      // Métriques de base (rétrocompatibilité)
      lotSize: parseFloat(lotSize.toFixed(2)),
      riskAmount: parseFloat(actualRiskAmount.toFixed(2)),
      pipDistance,
      riskRewardRatio: this.calculateRiskReward(entryPrice, stopLoss, takeProfit),
      
      // Nouvelles métriques de levier
      riskPercent: parseFloat(actualRiskPercent.toFixed(2)),
      marginUsed: parseFloat(marginUsed.toFixed(2)),
      leverage: specs.leverage,
      positionValue: parseFloat(positionValue.toFixed(2)),
      limitedBy: limitingFactor
    };
  }

  /**
   * Identifie quel facteur limite la taille de position
   */
  getLimitingFactor(limits, finalLotSize) {
    const tolerance = 0.001;
    
    if (Math.abs(finalLotSize - limits.risk) < tolerance) return 'risk';
    if (limits.margin && Math.abs(finalLotSize - limits.margin) < tolerance) return 'margin';
    if (Math.abs(finalLotSize - limits.strategy) < tolerance) return 'strategy';
    return 'broker';
  }

  /**
   * Récupère la valeur du pip pour un symbole (méthode existante - rétrocompatibilité)
   */
  getPipValue(symbol) {
    const specs = this.getSymbolSpecs(symbol);
    return specs.pipValue;
  }

  /**
   * Applique le Kelly Criterion pour optimiser la taille (votre méthode existante)
   */
  async applyKellyCriterion(baseLot, symbol) {
    // TODO: Implémenter le calcul basé sur l'historique des trades
    // Pour l'instant, on applique un facteur conservateur
    return baseLot * 0.8;
  }

  /**
   * Calcule le ratio risk/reward (votre méthode existante)
   */
  calculateRiskReward(entry, stopLoss, takeProfit) {
    if (!takeProfit) return null;

    const riskDistance = Math.abs(entry - stopLoss);
    const rewardDistance = Math.abs(takeProfit - entry);

    return rewardDistance / riskDistance;
  }

  /**
   * NOUVELLE MÉTHODE: Vérifie si une position peut être ouverte
   */
  canOpenPosition(symbol, lotSize, entryPrice, freeMargin) {
    const specs = this.getSymbolSpecs(symbol);
    const positionValue = lotSize * entryPrice * specs.contractSize;
    const marginRequired = positionValue / specs.leverage;
    return marginRequired <= freeMargin * 0.9; // Garde 10% de sécurité
  }

  /**
   * NOUVELLE MÉTHODE: Calcule la marge requise pour une position
   */
  calculateMarginRequirement(symbol, lotSize, entryPrice) {
    const specs = this.getSymbolSpecs(symbol);
    const positionValue = lotSize * entryPrice * specs.contractSize;
    return positionValue / specs.leverage;
  }
}

module.exports = PositionCalculator;