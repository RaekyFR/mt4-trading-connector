// nodejs/src/utils/LeverageManager.js

class LeverageManager {
  constructor(positionCalculator, prisma = null) {
    this.positionCalculator = positionCalculator;
    this.prisma = prisma;
  }

  /**
   * Met à jour le levier et sauvegarde la configuration
   * @param {number} newLeverage - Nouveau levier (ex: 30, 50, 100)
   * @param {string} reason - Raison du changement
   */
  async updateLeverage(newLeverage, reason = 'Configuration manuelle') {
    const oldLeverage = this.positionCalculator.defaultLeverage;
    
    console.log(`[LeverageManager] Changement de levier: ${oldLeverage}:1 -> ${newLeverage}:1`);
    console.log(`[LeverageManager] Raison: ${reason}`);
    
    // Valider le nouveau levier
    if (!this.isValidLeverage(newLeverage)) {
      throw new Error(`Levier invalide: ${newLeverage}. Doit être entre 1 et 500.`);
    }
    
    // Mettre à jour le PositionCalculator
    this.positionCalculator.updateLeverage(newLeverage);
    
    // Sauvegarder en base si Prisma disponible
    if (this.prisma) {
      await this.saveLeverageConfig(newLeverage, oldLeverage, reason);
    }
    
    // Log du résumé des changements
    this.logLeverageImpact(oldLeverage, newLeverage);
    
    return {
      success: true,
      oldLeverage,
      newLeverage,
      marginPercentOld: (100 / oldLeverage).toFixed(2),
      marginPercentNew: (100 / newLeverage).toFixed(2),
      impactSummary: this.calculateImpactSummary(oldLeverage, newLeverage)
    };
  }

  /**
   * Valide que le levier est dans une fourchette acceptable
   */
  isValidLeverage(leverage) {
    return leverage >= 1 && leverage <= 500 && Number.isInteger(leverage);
  }

  /**
   * Sauvegarde la configuration du levier en base
   */
  async saveLeverageConfig(newLeverage, oldLeverage, reason) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'leverage_updated',
          entityType: 'system_config',
          entityId: 'leverage_setting',
          details: JSON.stringify({
            oldLeverage,
            newLeverage,
            reason,
            marginPercentOld: (100 / oldLeverage).toFixed(2),
            marginPercentNew: (100 / newLeverage).toFixed(2),
            timestamp: new Date().toISOString()
          }),
          severity: 'INFO'
        }
      });
      
      console.log('[LeverageManager] Configuration sauvegardée en base');
    } catch (error) {
      console.error('[LeverageManager] Erreur sauvegarde:', error);
    }
  }

  /**
   * Calcule l'impact du changement de levier
   */
  calculateImpactSummary(oldLeverage, newLeverage) {
    const oldMarginPercent = 100 / oldLeverage;
    const newMarginPercent = 100 / newLeverage;
    const marginReduction = ((oldMarginPercent - newMarginPercent) / oldMarginPercent) * 100;
    
    return {
      marginRequirementChange: `${oldMarginPercent.toFixed(2)}% -> ${newMarginPercent.toFixed(2)}%`,
      marginReductionPercent: marginReduction.toFixed(1),
      leverageMultiplier: (newLeverage / oldLeverage).toFixed(2),
      riskLevel: this.assessRiskLevel(newLeverage)
    };
  }

  /**
   * Évalue le niveau de risque basé sur le levier
   */
  assessRiskLevel(leverage) {
    if (leverage <= 10) return 'CONSERVATEUR';
    if (leverage <= 30) return 'MODÉRÉ';
    if (leverage <= 50) return 'AGRESSIF';
    if (leverage <= 100) return 'TRÈS ÉLEVÉ';
    return 'EXTRÊME';
  }

  /**
   * Log l'impact du changement sur chaque symbole
   */
  logLeverageImpact(oldLeverage, newLeverage) {
    console.log('\n=== IMPACT DU CHANGEMENT DE LEVIER ===');
    
    Object.keys(this.positionCalculator.symbolSpecs).forEach(symbol => {
      const specs = this.positionCalculator.symbolSpecs[symbol];
      const examplePrice = this.getExamplePrice(symbol);
      const exampleLot = 0.1;
      
      const oldMargin = (exampleLot * examplePrice * specs.contractSize) / oldLeverage;
      const newMargin = (exampleLot * examplePrice * specs.contractSize) / newLeverage;
      const savings = oldMargin - newMargin;
      
      console.log(`${symbol}: Marge pour ${exampleLot} lot à ${examplePrice}`);
      console.log(`  Avant: $${oldMargin.toFixed(2)} | Après: $${newMargin.toFixed(2)} | Économie: $${savings.toFixed(2)}`);
    });
    
    console.log('=====================================\n');
  }

  /**
   * Obtient un prix d'exemple pour les calculs de démonstration
   */
  getExamplePrice(symbol) {
    const examplePrices = {
      'EURUSD': 1.1000,
      'GBPUSD': 1.2500,
      'USDJPY': 150.00,
      'XAUUSD': 2000.00,
      'BTCUSD': 58500,
      'NAS100': 16000,
      'US500': 4500,
      'SPX500': 4500
    };
    
    return examplePrices[symbol] || 1.0;
  }

  /**
   * Obtient la configuration actuelle du levier
   */
  getCurrentLeverageConfig() {
    const leverage = this.positionCalculator.defaultLeverage;
    const marginPercent = 100 / leverage;
    
    return {
      leverage,
      marginPercent: parseFloat(marginPercent.toFixed(2)),
      riskLevel: this.assessRiskLevel(leverage),
      symbolsCount: Object.keys(this.positionCalculator.symbolSpecs).length,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Simule l'impact d'un changement de levier sans l'appliquer
   */
  simulateLeverageChange(newLeverage, testBalance = 10000, testSymbol = 'BTCUSD') {
    if (!this.isValidLeverage(newLeverage)) {
      throw new Error(`Levier invalide: ${newLeverage}`);
    }
    
    const currentLeverage = this.positionCalculator.defaultLeverage;
    const specs = this.positionCalculator.getSymbolSpecs(testSymbol);
    const testPrice = this.getExamplePrice(testSymbol);
    const testLot = 0.1;
    
    // Calculs avec levier actuel
    const currentMargin = (testLot * testPrice * specs.contractSize) / currentLeverage;
    const currentMaxLots = testBalance / currentMargin;
    
    // Calculs avec nouveau levier
    const newMargin = (testLot * testPrice * specs.contractSize) / newLeverage;
    const newMaxLots = testBalance / newMargin;
    
    return {
      testScenario: {
        balance: testBalance,
        symbol: testSymbol,
        price: testPrice,
        lotSize: testLot
      },
      currentLeverage: {
        leverage: currentLeverage,
        marginRequired: currentMargin.toFixed(2),
        maxPossibleLots: currentMaxLots.toFixed(2)
      },
      newLeverage: {
        leverage: newLeverage,
        marginRequired: newMargin.toFixed(2),
        maxPossibleLots: newMaxLots.toFixed(2)
      },
      improvement: {
        marginSavings: (currentMargin - newMargin).toFixed(2),
        additionalLots: (newMaxLots - currentMaxLots).toFixed(2),
        capacityIncrease: (((newMaxLots / currentMaxLots) - 1) * 100).toFixed(1) + '%'
      }
    };
  }
}

module.exports = LeverageManager;