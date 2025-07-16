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

module.exports = RiskValidator;
