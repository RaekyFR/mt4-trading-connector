// nodejs/src/risk/RiskManager.js
const { PrismaClient } = require('@prisma/client');
const PositionCalculator = require('./PositionCalculator');
const RiskValidator = require('./RiskValidator');
const CorrelationAnalyzer = require('./CorrelationAnalyzer');

class RiskManager {
  constructor() {
    this.prisma = new PrismaClient();
    this.positionCalculator = new PositionCalculator();
    this.riskValidator = new RiskValidator(this.prisma);
    this.correlationAnalyzer = new CorrelationAnalyzer();
  }

  /**
   * Valide et enrichit un signal avant traitement
   * @param {Object} signal - Signal brut de TradingView
   * @returns {Object} Signal validé avec lot calculé ou erreur
   */
  async validateSignal(signal) {
    try {
      console.log(`[RiskManager] Validation du signal:`, signal);

      // 1. Récupérer la stratégie
      const strategy = await this.prisma.strategy.findUnique({
        where: { name: signal.strategy },
        include: { riskConfigs: { where: { isActive: true } } }
      });

      if (!strategy || !strategy.isActive) {
        throw new Error(`Stratégie ${signal.strategy} inactive ou introuvable`);
      }

      // 2. Récupérer la config de risk (globale ou de la stratégie)
      const riskConfig = strategy.riskConfigs[0] || await this.getGlobalRiskConfig();

      // 3. Vérifier les limites globales
      const globalCheck = await this.riskValidator.checkGlobalLimits(riskConfig);
      if (!globalCheck.passed) {
        throw new Error(`Limite globale atteinte: ${globalCheck.reason}`);
      }

      // 4. Vérifier les limites par symbole
      const symbolCheck = await this.riskValidator.checkSymbolLimits(
        signal.symbol, 
        riskConfig
      );
      if (!symbolCheck.passed) {
        throw new Error(`Limite symbole atteinte: ${symbolCheck.reason}`);
      }

      // 5. Analyser les corrélations
      const correlations = await this.correlationAnalyzer.checkNewPosition(
        signal.symbol,
        riskConfig.maxCorrelation
      );
      if (correlations.blocked) {
        throw new Error(`Corrélation trop élevée: ${correlations.reason}`);
      }

      // 6. Récupérer l'état du compte MT4
      const accountState = await this.getAccountState();

      // 7. Calculer la taille de position
      const positionSize = await this.positionCalculator.calculateLotSize({
        balance: accountState.balance,
        symbol: signal.symbol,
        stopLoss: signal.stopLoss,
        entryPrice: signal.price,
        riskPercent: signal.riskPercent || strategy.defaultRiskPercent,
        maxLotSize: Math.min(riskConfig.maxLotSize, strategy.maxLotSize)
      });

      // 8. Vérifier que le lot calculé respecte les limites
      const lotCheck = await this.riskValidator.checkLotSize(
        positionSize.lotSize,
        signal.symbol,
        riskConfig
      );
      if (!lotCheck.passed) {
        throw new Error(`Taille de lot invalide: ${lotCheck.reason}`);
      }

      // 9. Enregistrer le signal validé
      const validatedSignal = await this.prisma.signal.create({
        data: {
          strategyId: strategy.id,
          action: signal.action,
          symbol: signal.symbol,
          price: signal.price,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          suggestedLot: signal.lot,
          calculatedLot: positionSize.lotSize,
          riskAmount: positionSize.riskAmount,
          status: 'VALIDATED',
          rawData: JSON.stringify(signal),
          source: signal.source || 'tradingview'
        }
      });

      // 10. Enregistrer les métriques de risk
      await this.recordRiskMetrics(validatedSignal.id, accountState);

      return {
        success: true,
        signal: validatedSignal,
        lotSize: positionSize.lotSize,
        riskAmount: positionSize.riskAmount,
        correlations: correlations.data
      };

    } catch (error) {
      console.error(`[RiskManager] Erreur validation:`, error);
      
      // Enregistrer le signal rejeté
      if (signal.strategy) {
        const strategy = await this.prisma.strategy.findUnique({
          where: { name: signal.strategy }
        });
        
        if (strategy) {
          await this.prisma.signal.create({
            data: {
              strategyId: strategy.id,
              action: signal.action,
              symbol: signal.symbol,
              price: signal.price,
              stopLoss: signal.stopLoss,
              takeProfit: signal.takeProfit,
              status: 'REJECTED',
              errorMessage: error.message,
              rawData: JSON.stringify(signal),
              source: signal.source || 'tradingview'
            }
          });
        }
      }

      await this.logAudit('signal_rejected', 'signal', null, {
        reason: error.message,
        signal
      }, 'WARNING');

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Récupère la configuration de risk globale
   */
  async getGlobalRiskConfig() {
    let config = await this.prisma.riskConfig.findFirst({
      where: { 
        strategyId: null,
        isActive: true 
      }
    });

    // Créer une config par défaut si elle n'existe pas
    if (!config) {
      config = await this.prisma.riskConfig.create({
        data: {
          strategyId: null,
          isActive: true
        }
      });
    }

    return config;
  }

  /**
   * Récupère l'état actuel du compte MT4
   */
  async getAccountState() {
    // Récupérer le dernier état enregistré
    const lastState = await this.prisma.accountState.findFirst({
      orderBy: { lastUpdate: 'desc' }
    });

    // Si trop ancien (> 1 minute), demander une mise à jour à MT4
    if (!lastState || Date.now() - lastState.lastUpdate.getTime() > 60000) {
      // TODO: Implémenter la requête à MT4
      console.log('[RiskManager] État du compte trop ancien, mise à jour requise');
    }

    return lastState || {
      balance: 10000,    // Valeurs par défaut pour les tests
      equity: 10000,
      margin: 0,
      freeMargin: 10000,
      marginLevel: 0
    };
  }

  /**
   * Enregistre les métriques de risk actuelles
   */
  async recordRiskMetrics(orderId, accountState) {
    // Calculer les métriques
    const positions = await this.prisma.order.count({
      where: { 
        status: { in: ['PLACED', 'FILLED', 'PARTIAL'] }
      }
    });

    const totalExposure = await this.prisma.order.aggregate({
      where: { 
        status: { in: ['PLACED', 'FILLED', 'PARTIAL'] }
      },
      _sum: { lots: true }
    });

    const totalRisk = await this.prisma.order.aggregate({
      where: { 
        status: { in: ['PLACED', 'FILLED', 'PARTIAL'] }
      },
      _sum: { riskAmount: true }
    });

    // PnL periods
    const dailyPnL = await this.calculatePeriodPnL('day');
    const weeklyPnL = await this.calculatePeriodPnL('week');
    const monthlyPnL = await this.calculatePeriodPnL('month');

    await this.prisma.riskMetric.create({
      data: {
        orderId,
        balance: accountState.balance,
        equity: accountState.equity,
        margin: accountState.margin,
        freeMargin: accountState.freeMargin,
        marginLevel: accountState.marginLevel,
        openPositions: positions,
        totalExposure: totalExposure._sum.lots || 0,
        totalRisk: totalRisk._sum.riskAmount || 0,
        dailyPnL,
        weeklyPnL,
        monthlyPnL
      }
    });
  }

  /**
   * Calcule le P&L pour une période donnée
   */
  async calculatePeriodPnL(period) {
    const startDate = new Date();
    
    switch(period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    const result = await this.prisma.order.aggregate({
      where: {
        closeTime: { gte: startDate },
        status: 'CLOSED'
      },
      _sum: { profit: true }
    });

    return result._sum.profit || 0;
  }

  /**
   * Vérifie si le trading est autorisé (horaires, dates)
   */
  async isTradingAllowed(symbol, riskConfig) {
    const now = new Date();
    
    // Vérifier les dates bloquées
    if (riskConfig.blockedDates) {
      const blocked = JSON.parse(riskConfig.blockedDates);
      const today = now.toISOString().split('T')[0];
      if (blocked.includes(today)) {
        return { allowed: false, reason: 'Date bloquée' };
      }
    }

    // Vérifier les horaires de trading
    if (riskConfig.tradingHours) {
      const hours = JSON.parse(riskConfig.tradingHours);
      const day = now.toLocaleLowerCase();
      const currentTime = now.toTimeString().slice(0, 5);

      if (hours[day]) {
        if (currentTime < hours[day].start || currentTime > hours[day].end) {
          return { allowed: false, reason: 'Hors horaires de trading' };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Enregistre une entrée dans le log d'audit
   */
  async logAudit(action, entityType, entityId, details, severity = 'INFO') {
    await this.prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        details: JSON.stringify(details),
        severity
      }
    });
  }

  /**
   * Nettoie les ressources
   */
  async cleanup() {
    await this.prisma.$disconnect();
  }
}

module.exports = RiskManager;