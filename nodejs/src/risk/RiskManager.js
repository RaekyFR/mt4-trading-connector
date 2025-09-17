// nodejs/src/risk/RiskManager.js
const { PrismaClient } = require('@prisma/client');
const PositionCalculator = require('./PositionCalculator');
const RiskValidator = require('./RiskValidator');
// Suppression de CorrelationAnalyzer

class RiskManager {
 /* constructor() {
    this.prisma = new PrismaClient();
    this.positionCalculator = new PositionCalculator();
    this.riskValidator = new RiskValidator(this.prisma);
    // Suppression de correlationAnalyzer
  }*/
   constructor(mt4Connector = null) {  // ✅ NOUVEAU : Accepter MT4Connector
    this.prisma = new PrismaClient();
    this.positionCalculator = new PositionCalculator();
    this.riskValidator = new RiskValidator(this.prisma);
    this.mt4Connector = mt4Connector;  // ✅ NOUVEAU : Stocker la référence
  }

  /**
   * Valide et enrichit un signal avant traitement
   * @param {Object} signal - Signal brut de TradingView
   * @returns {Object} Signal validé avec lot calculé ou erreur
   */

  /**
 * Valide et enrichit un signal avant traitement
 * MODIFIÉ pour gérer entry_price et current_price
 */
/*async validateSignal(signal) {
  try {
    console.log(`[RiskManager] Validation du signal:`, signal);

    // 1. Déterminer le type d'ordre et le prix pour calculs
    const { orderType, calculationPrice } = this.determineOrderTypeAndPrice(signal);
    console.log(`[RiskManager] Type d'ordre détecté: ${orderType}, Prix pour calculs: ${calculationPrice}`);

    // 2. Récupérer la stratégie
    const strategy = await this.prisma.strategy.findUnique({
      where: { name: signal.strategy },
      include: { riskConfigs: { where: { isActive: true } } }
    });

    if (!strategy || !strategy.isActive) {
      throw new Error(`Stratégie ${signal.strategy} inactive ou introuvable`);
    }

    // 3. Récupérer la config de risk
    const riskConfig = strategy.riskConfigs[0] || await this.getGlobalRiskConfig();

    // 4. Vérifier les limites de perte quotidienne
    const dailyPnL = await this.calculatePeriodPnL('day');
    const accountState = await this.getAccountState();
    const dailyLossPercent = Math.abs(dailyPnL / accountState.balance) * 100;

    if (dailyPnL < 0 && dailyLossPercent >= riskConfig.maxDailyLoss) {
      throw new Error(`Limite de perte quotidienne atteinte: ${dailyLossPercent.toFixed(2)}% (max: ${riskConfig.maxDailyLoss}%)`);
    }

    // 5. Vérifier les heures de trading
    const tradingHoursCheck = await this.isTradingAllowed(signal.symbol, riskConfig);
    if (!tradingHoursCheck.allowed) {
      throw new Error(`Trading non autorisé: ${tradingHoursCheck.reason}`);
    }

    // 6. Calculer la taille de position avec le bon prix
    const positionSize = await this.positionCalculator.calculateLotSize({
      balance: accountState.balance,
      symbol: signal.symbol,
      stopLoss: signal.stopLoss,
      entryPrice: calculationPrice, // Utiliser le prix approprié
      riskPercent: strategy.defaultRiskPercent,
      maxLotSize: strategy.maxLotSize
    });

    // 7. Vérifier les limites de lot
    if (positionSize.lotSize > strategy.maxLotSize) {
      throw new Error(`Lot calculé (${positionSize.lotSize}) dépasse la limite de la stratégie (${strategy.maxLotSize})`);
    }

    // 8. Calculer le Take Profit avec le bon prix
    const takeProfit = await this.calculateTakeProfit(signal, strategy, calculationPrice);

    // 9. Enregistrer le signal validé avec les métadonnées de type d'ordre
    const validatedSignal = await this.prisma.signal.create({
      data: {
        strategyId: strategy.id,
        action: signal.action,
        symbol: signal.symbol,
        price: signal.entry_price || null, // Prix cible (peut être null pour market)
        stopLoss: signal.stopLoss,
        takeProfit: takeProfit,
        suggestedLot: signal.lot,
        calculatedLot: positionSize.lotSize,
        riskAmount: positionSize.riskAmount,
        status: 'VALIDATED',
        rawData: JSON.stringify({
          ...signal,
          orderType, // Ajouter le type d'ordre détecté
          calculationPrice // Ajouter le prix utilisé pour les calculs
        }),
        source: signal.source || 'tradingview'
      }
    });

    console.log(`[RiskManager] Signal validé - ID: ${validatedSignal.id}, Type: ${orderType}, Lot: ${positionSize.lotSize}, TP: ${takeProfit}`);

    return {
      success: true,
      signal: validatedSignal,
      orderType,
      calculationPrice,
      lotSize: positionSize.lotSize,
      riskAmount: positionSize.riskAmount,
      takeProfit: takeProfit,
      riskRewardRatio: positionSize.riskRewardRatio
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
            price: signal.entry_price || null,
            stopLoss: signal.stopLoss,
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
}*/

/**
 * Valide et enrichit un signal avant traitement
 * VERSION MISE À JOUR avec gestion du levier
 */
async validateSignal(signal) {
  try {
    console.log(`[RiskManager] Validation du signal:`, signal);

    // 1. Déterminer le type d'ordre et le prix pour calculs
    const { orderType, calculationPrice } = this.determineOrderTypeAndPrice(signal);
    console.log(`[RiskManager] Type d'ordre détecté: ${orderType}, Prix pour calculs: ${calculationPrice}`);

    // 2. Récupérer la stratégie
    const strategy = await this.prisma.strategy.findUnique({
      where: { name: signal.strategy },
      include: { riskConfigs: { where: { isActive: true } } }
    });

    if (!strategy || !strategy.isActive) {
      throw new Error(`Stratégie ${signal.strategy} inactive ou introuvable`);
    }

    // 3. Récupérer la config de risk
    const riskConfig = strategy.riskConfigs[0] || await this.getGlobalRiskConfig();

    // 4. Vérifier les limites de perte quotidienne
    const dailyPnL = await this.calculatePeriodPnL('day');
    const accountState = await this.getAccountState();
    const dailyLossPercent = Math.abs(dailyPnL / accountState.balance) * 100;

    if (dailyPnL < 0 && dailyLossPercent >= riskConfig.maxDailyLoss) {
      throw new Error(`Limite de perte quotidienne atteinte: ${dailyLossPercent.toFixed(2)}% (max: ${riskConfig.maxDailyLoss}%)`);
    }

    // 5. Vérifier les heures de trading
    const tradingHoursCheck = await this.isTradingAllowed(signal.symbol, riskConfig);
    if (!tradingHoursCheck.allowed) {
      throw new Error(`Trading non autorisé: ${tradingHoursCheck.reason}`);
    }

    // 6. Calculer la taille de position AVEC LEVIER
    console.log('[RiskManager] État du compte pour calcul:', {
      balance: accountState.balance,
      freeMargin: accountState.freeMargin || 'non disponible'
    });

    const positionSize = await this.positionCalculator.calculateLotSize({
      balance: accountState.balance,
      freeMargin: accountState.freeMargin, // ✅ Nouveau: marge libre
      symbol: signal.symbol,
      stopLoss: signal.stopLoss,
      entryPrice: calculationPrice,
      riskPercent: strategy.defaultRiskPercent,
      maxLotSize: strategy.maxLotSize
    });

    // 7. Vérifications supplémentaires avec levier
    if (positionSize.marginUsed && accountState.freeMargin) {
      if (positionSize.marginUsed > accountState.freeMargin * 0.9) { // Garde 10% de sécurité
        throw new Error(`Marge insuffisante: ${positionSize.marginUsed.toFixed(2)}$ requis, ${accountState.freeMargin.toFixed(2)}$ disponible`);
      }
    }

    // 8. Vérifier les limites de lot
    if (positionSize.lotSize > strategy.maxLotSize) {
      throw new Error(`Lot calculé (${positionSize.lotSize}) dépasse la limite de la stratégie (${strategy.maxLotSize})`);
    }

    // 9. Calculer le Take Profit avec validation
    const takeProfit = await this.calculateTakeProfit(signal, strategy, calculationPrice);

    // 10. Log des informations de levier
    console.log(`[RiskManager] Position avec levier:`, {
      lotSize: positionSize.lotSize,
      marginUsed: positionSize.marginUsed || 'N/A',
      leverage: positionSize.leverage || 'N/A',
      riskAmount: positionSize.riskAmount,
      limitedBy: positionSize.limitedBy || 'risk'
    });

    // 11. Enregistrer le signal validé avec les métadonnées de levier
    const validatedSignal = await this.prisma.signal.create({
      data: {
        strategyId: strategy.id,
        action: signal.action,
        symbol: signal.symbol,
        price: signal.entry_price || null,
        stopLoss: signal.stopLoss,
        takeProfit: takeProfit,
        suggestedLot: signal.lot,
        calculatedLot: positionSize.lotSize,
        riskAmount: positionSize.riskAmount,
        status: 'VALIDATED',
        rawData: JSON.stringify({
          ...signal,
          orderType,
          calculationPrice,
          leverageInfo: { // ✅ Nouveau: info levier
            marginUsed: positionSize.marginUsed,
            leverage: positionSize.leverage,
            limitedBy: positionSize.limitedBy,
            positionValue: positionSize.positionValue
          }
        }),
        source: signal.source || 'tradingview'
      }
    });

    console.log(`[RiskManager] Signal validé - ID: ${validatedSignal.id}, Type: ${orderType}, Lot: ${positionSize.lotSize}, TP: ${takeProfit}`);

    return {
      success: true,
      signal: validatedSignal,
      orderType,
      calculationPrice,
      lotSize: positionSize.lotSize,
      riskAmount: positionSize.riskAmount,
      takeProfit: takeProfit,
      riskRewardRatio: positionSize.riskRewardRatio,
      // ✅ Nouveau: infos levier
      leverageInfo: {
        marginUsed: positionSize.marginUsed,
        leverage: positionSize.leverage,
        limitedBy: positionSize.limitedBy
      }
    };

  } catch (error) {
    console.error(`[RiskManager] Erreur validation:`, error);
    
    // Enregistrer le signal rejeté (code existant inchangé)
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
            price: signal.entry_price || null,
            stopLoss: signal.stopLoss,
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
 * NOUVELLE MÉTHODE : Détermine le type d'ordre et le prix pour calculs
 */
determineOrderTypeAndPrice(signal) {
  // Si entry_price est absent, 0, ou null → Ordre MARKET
  if (!signal.entry_price || signal.entry_price === 0) {
    if (!signal.current_price) {
      throw new Error('current_price requis pour les ordres market');
    }
    return {
      orderType: 'MARKET',
      calculationPrice: signal.current_price
    };
  }
  
  // Sinon → Ordre LIMIT
  return {
    orderType: 'LIMIT',
    calculationPrice: signal.entry_price
  };
}

/**
 * Calcule le Take Profit - MODIFIÉ pour accepter calculationPrice
 */
async calculateTakeProfit(signal, strategy, calculationPrice) {
  const riskRewardRatio = strategy.riskRewardRatio || 2.0;
  
  if (!signal.stopLoss || !calculationPrice) {
    return null;
  }

  const entryPrice = calculationPrice; // Utiliser le prix de calcul
  const stopLoss = signal.stopLoss;
  const riskDistance = Math.abs(entryPrice - stopLoss);
  
  let takeProfit;
  if (signal.action === 'buy') {
    takeProfit = entryPrice + (riskDistance * riskRewardRatio);
  } else {
    takeProfit = entryPrice - (riskDistance * riskRewardRatio);
  }

  return Math.round(takeProfit * 100000) / 100000;
}

  /*
async validateSignal(signal) {
  try {
    console.log(`[RiskManager] Validation du signal:`, signal);

    1. Récupérer la stratégie (elle existe déjà, vérifiée dans webhook)
    const strategy = await this.prisma.strategy.findUnique({
      where: { name: signal.strategy },
      include: { riskConfigs: { where: { isActive: true } } }
    });

    if (!strategy || !strategy.isActive) {
      throw new Error(`Stratégie ${signal.strategy} inactive ou introuvable`);
    }

    2. Récupérer la config de risk (de la stratégie ou globale)
    const riskConfig = strategy.riskConfigs[0] || await this.getGlobalRiskConfig();

    3. Vérifier uniquement les limites de perte quotidienne
    const dailyPnL = await this.calculatePeriodPnL('day');
    const accountState = await this.getAccountState();
    const dailyLossPercent = Math.abs(dailyPnL / accountState.balance) * 100;

    if (dailyPnL < 0 && dailyLossPercent >= riskConfig.maxDailyLoss) {
      throw new Error(`Limite de perte quotidienne atteinte: ${dailyLossPercent.toFixed(2)}% (max: ${riskConfig.maxDailyLoss}%)`);
    }

    4. Vérifier les heures de trading si configurées
    const tradingHoursCheck = await this.isTradingAllowed(signal.symbol, riskConfig);
    if (!tradingHoursCheck.allowed) {
      throw new Error(`Trading non autorisé: ${tradingHoursCheck.reason}`);
    }

    5. Calculer la taille de position
    const positionSize = await this.positionCalculator.calculateLotSize({
      balance: accountState.balance,
      symbol: signal.symbol,
      stopLoss: signal.stopLoss,
      entryPrice: signal.price || 1.1, // Prix par défaut si null
      riskPercent: strategy.defaultRiskPercent,
      maxLotSize: strategy.maxLotSize
    });

    6. Vérifier que le lot calculé respecte les limites de la stratégie
    if (positionSize.lotSize > strategy.maxLotSize) {
      throw new Error(`Lot calculé (${positionSize.lotSize}) dépasse la limite de la stratégie (${strategy.maxLotSize})`);
    }

    7. Calculer le Take Profit basé sur le Risk/Reward de la stratégie
    const takeProfit = await this.calculateTakeProfit(signal, strategy, positionSize);

    8. Enregistrer le signal validé
    const validatedSignal = await this.prisma.signal.create({
      data: {
        strategyId: strategy.id,
        action: signal.action,
        symbol: signal.symbol,
        price: signal.price,
        stopLoss: signal.stopLoss,
        takeProfit: takeProfit,
        suggestedLot: signal.lot,
        calculatedLot: positionSize.lotSize,
        riskAmount: positionSize.riskAmount,
        status: 'VALIDATED',
        rawData: JSON.stringify(signal),
        source: signal.source || 'tradingview'
      }
    });

    console.log(`[RiskManager] Signal validé - ID: ${validatedSignal.id}, Lot: ${positionSize.lotSize}, TP: ${takeProfit}`);

    return {
      success: true,
      signal: validatedSignal,
      lotSize: positionSize.lotSize,
      riskAmount: positionSize.riskAmount,
      takeProfit: takeProfit,
      riskRewardRatio: positionSize.riskRewardRatio
    };

  } catch (error) {
    console.error(`[RiskManager] Erreur validation:`, error);
    
    Enregistrer le signal rejeté si possible
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
}/*
  /*async validateSignal(signal) {
    try {
      console.log(`[RiskManager] Validation du signal:`, signal);

      // 1. Récupérer la stratégie (elle existe déjà, vérifiée dans webhook)
      const strategy = await this.prisma.strategy.findUnique({
        where: { name: signal.strategy },
        include: { riskConfigs: { where: { isActive: true } } }
      });

      if (!strategy || !strategy.isActive) {
        throw new Error(`Stratégie ${signal.strategy} inactive ou introuvable`);
      }

      // 2. Récupérer la config de risk (de la stratégie ou globale)
      const riskConfig = strategy.riskConfigs[0] || await this.getGlobalRiskConfig();

      // 3. Vérifier uniquement les limites de perte quotidienne
      const dailyLossCheck = await this.riskValidator.checkDailyLoss(riskConfig);
      if (!dailyLossCheck.passed) {
        throw new Error(`Limite de perte quotidienne atteinte: ${dailyLossCheck.reason}`);
      }

      // 4. Vérifier les heures de trading si configurées
      const tradingHoursCheck = await this.isTradingAllowed(signal.symbol, riskConfig);
      if (!tradingHoursCheck.allowed) {
        throw new Error(`Trading non autorisé: ${tradingHoursCheck.reason}`);
      }

      // 5. Récupérer l'état du compte MT4
      const accountState = await this.getAccountState();

      // 6. Calculer la taille de position
      const positionSize = await this.positionCalculator.calculateLotSize({
        balance: accountState.balance,
        symbol: signal.symbol,
        stopLoss: signal.stopLoss,
        entryPrice: signal.price,
        riskPercent: signal.riskPercent || strategy.defaultRiskPercent,
        maxLotSize: strategy.maxLotSize // Défini manuellement par stratégie
      });

      // 7. Vérifier que le lot calculé respecte les limites de la stratégie
      if (positionSize.lotSize > strategy.maxLotSize) {
        throw new Error(`Lot calculé (${positionSize.lotSize}) dépasse la limite de la stratégie (${strategy.maxLotSize})`);
      }

      // 8. Calculer le Take Profit basé sur le Risk/Reward de la stratégie
      const takeProfit = await this.calculateTakeProfit(signal, strategy, positionSize);

      // 9. Enregistrer le signal validé
      const validatedSignal = await this.prisma.signal.create({
        data: {
          strategyId: strategy.id,
          action: signal.action,
          symbol: signal.symbol,
          price: signal.price,
          stopLoss: signal.stopLoss,
          takeProfit: takeProfit,
          suggestedLot: signal.lot,
          calculatedLot: positionSize.lotSize,
          riskAmount: positionSize.riskAmount,
          status: 'VALIDATED',
          rawData: JSON.stringify(signal),
          source: signal.source || 'tradingview'
        }
      });

      // 10. Enregistrer les métriques de risk simplifiées
      await this.recordRiskMetrics(validatedSignal.id, accountState);

      return {
        success: true,
        signal: validatedSignal,
        lotSize: positionSize.lotSize,
        riskAmount: positionSize.riskAmount,
        takeProfit: takeProfit,
        riskRewardRatio: positionSize.riskRewardRatio
      };

    } catch (error) {
      console.error(`[RiskManager] Erreur validation:`, error);
      
      // Enregistrer le signal rejeté si possible
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
  }*/

/**
 * Calcule le Take Profit basé sur le Risk/Reward de la stratégie
 * @param {Object} signal - Signal de trading
 * @param {Object} strategy - Stratégie avec riskRewardRatio
 * @param {number} calculationPrice - Prix à utiliser (current_price pour MARKET, entry_price pour LIMIT)
 * @returns {number|null} Prix du Take Profit ou null si impossible à calculer
 */
async calculateTakeProfit(signal, strategy, calculationPrice) {
  console.log('[RiskManager] Calcul TP - Inputs:', {
    stopLoss: signal.stopLoss,
    calculationPrice,
    action: signal.action,
    riskRewardRatio: strategy.riskRewardRatio
  });

  const riskRewardRatio = strategy.riskRewardRatio || 2.0;
  
  // Vérifier que nous avons les données nécessaires
  if (!signal.stopLoss || !calculationPrice) {
    console.log('[RiskManager] TP = null - Données manquantes:', {
      stopLoss: signal.stopLoss,
      calculationPrice
    });
    return null;
  }

  // Vérifier que les prix sont cohérents
  if (calculationPrice <= 0 || signal.stopLoss <= 0) {
    console.log('[RiskManager] TP = null - Prix invalides');
    return null;
  }

  const entryPrice = calculationPrice;
  const stopLoss = signal.stopLoss;
  const riskDistance = Math.abs(entryPrice - stopLoss);
  
  let takeProfit;
  if (signal.action === 'buy') {
    // Pour un BUY: TP = Entry + (Risk Distance * RR Ratio)
    takeProfit = entryPrice + (riskDistance * riskRewardRatio);
  } else if (signal.action === 'sell') {
    // Pour un SELL: TP = Entry - (Risk Distance * RR Ratio)  
    takeProfit = entryPrice - (riskDistance * riskRewardRatio);
  } else {
    console.log('[RiskManager] TP = null - Action invalide:', signal.action);
    return null;
  }

  const roundedTP = Math.round(takeProfit * 100000) / 100000;
  
  console.log('[RiskManager] TP calculé:', {
    entryPrice,
    stopLoss,
    riskDistance,
    riskRewardRatio,
    takeProfit: roundedTP
  });

  return roundedTP;
}

  /**
   * Calcule le Take Profit basé sur le Risk/Reward de la stratégie
   */
  /*async calculateTakeProfit(signal, strategy, positionSize) {
    // Récupérer le Risk/Reward configuré pour la stratégie (défaut: 2.0)
    const riskRewardRatio = strategy.riskRewardRatio || 2.0;
    
    if (!signal.stopLoss || !signal.price) {
      return null; // Pas de TP si pas de SL ou prix d'entrée
    }

    const entryPrice = signal.price;
    const stopLoss = signal.stopLoss;
    const riskDistance = Math.abs(entryPrice - stopLoss);
    
    let takeProfit;
    if (signal.action === 'buy') {
      // Pour un BUY: TP = Entry + (Risk Distance * RR Ratio)
      takeProfit = entryPrice + (riskDistance * riskRewardRatio);
    } else {
      // Pour un SELL: TP = Entry - (Risk Distance * RR Ratio)  
      takeProfit = entryPrice - (riskDistance * riskRewardRatio);
    }

    return Math.round(takeProfit * 100000) / 100000; // Arrondir à 5 décimales
  }*/

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
          maxDailyLoss: 5.0, // 5% par défaut
          isActive: true
        }
      });
    }

    return config;
  }

  /**
 * Récupère l'état actuel du compte MT4 avec marge libre
 * Utilise MT4Connector pour récupérer les données en temps réel
 */
async getAccountState() {
  try {
    console.log('[RiskManager] Récupération état du compte...');

    // 1. Essayer de récupérer via MT4Connector si disponible
    if (this.mt4Connector && this.mt4Connector.isConnected) {
      console.log('[RiskManager] Récupération via MT4Connector...');
      
      try {
        // Utiliser la nouvelle méthode getAccountInfo du MT4Connector
        const accountInfo = await this.mt4Connector.getAccountInfo();
        
        console.log('[RiskManager] Données MT4 récupérées:', {
          balance: accountInfo.balance,
          equity: accountInfo.equity,
          margin: accountInfo.margin,
          freeMargin: accountInfo.freeMargin,
          marginLevel: accountInfo.marginLevel
        });

        // Sauvegarder en base pour historique/cache
        if (this.prisma) {
          await this.prisma.accountState.create({
            data: {
              accountNumber: accountInfo.accountNumber || null,
              broker: accountInfo.broker || 'Unknown',
              currency: accountInfo.currency || 'USD',
              balance: accountInfo.balance,
              equity: accountInfo.equity,
              margin: accountInfo.margin,
              freeMargin: accountInfo.freeMargin,
              marginLevel: accountInfo.marginLevel,
              lastUpdate: new Date()
            }
          });
          
          console.log('[RiskManager] État compte sauvegardé en base');
        }

        return {
          balance: accountInfo.balance,
          equity: accountInfo.equity,
          margin: accountInfo.margin,
          freeMargin: accountInfo.freeMargin,
          marginLevel: accountInfo.marginLevel,
          currency: accountInfo.currency,
          leverage: accountInfo.leverage,
          source: 'mt4_live'
        };

      } catch (mt4Error) {
        console.warn('[RiskManager] Erreur MT4Connector:', mt4Error.message);
        console.log('[RiskManager] Fallback vers base de données...');
        
        // Fallback vers la base de données en cas d'erreur MT4
      }
    } else {
      console.log('[RiskManager] MT4Connector non disponible, utilisation cache...');
    }

    // 2. Fallback : récupérer depuis la base de données
    const lastState = await this.prisma.accountState.findFirst({
      orderBy: { lastUpdate: 'desc' }
    });

    if (lastState) {
      const ageMinutes = (Date.now() - lastState.lastUpdate.getTime()) / 60000;
      
      console.log(`[RiskManager] État depuis DB (${ageMinutes.toFixed(1)}min):`, {
        balance: lastState.balance,
        equity: lastState.equity,
        freeMargin: lastState.freeMargin
      });

      // Alerter si les données sont trop anciennes
      if (ageMinutes > 5) {
        console.warn(`[RiskManager] Données de compte anciennes (${ageMinutes.toFixed(1)}min)`);
      }

      return {
        balance: lastState.balance,
        equity: lastState.equity,
        margin: lastState.margin,
        freeMargin: lastState.freeMargin,
        marginLevel: lastState.marginLevel,
        currency: lastState.currency || 'USD',
        leverage: 30, // Valeur par défaut
        source: `database_${ageMinutes.toFixed(1)}min_old`
      };
    }

    // 3. Dernière option : essayer getBalance (votre méthode existante)
    if (this.mt4Connector) {
      try {
        console.log('[RiskManager] Tentative getBalance...');
        const balanceInfo = await this.mt4Connector.getBalance();
        
        if (balanceInfo.success) {
          console.log('[RiskManager] Balance récupérée:', balanceInfo);
          
          return {
            balance: balanceInfo.balance || 10000,
            equity: balanceInfo.equity || balanceInfo.balance || 10000,
            margin: balanceInfo.margin || 0,
            freeMargin: balanceInfo.freeMargin || balanceInfo.equity || 10000,
            marginLevel: balanceInfo.marginLevel || 0,
            currency: 'USD',
            leverage: 30,
            source: 'mt4_balance_fallback'
          };
        }
      } catch (balanceError) {
        console.warn('[RiskManager] Erreur getBalance:', balanceError.message);
      }
    }

    // 4. Valeurs par défaut si tout échoue
    console.warn('[RiskManager] Aucune source de données disponible, valeurs par défaut');
    
    return {
      balance: 10000,      // Valeur par défaut pour dev/test
      equity: 10000,
      margin: 0,
      freeMargin: 10000,   // Important pour les calculs de levier
      marginLevel: 0,
      currency: 'USD',
      leverage: 30,
      source: 'default_values'
    };

  } catch (error) {
    console.error('[RiskManager] Erreur critique getAccountState:', error);
    
    // Log d'audit pour erreur critique
    if (this.prisma) {
      await this.logAudit('account_state_error', 'system', null, {
        error: error.message,
        stack: error.stack
      }, 'ERROR');
    }

    // Retourner des valeurs par défaut même en cas d'erreur
    return {
      balance: 10000,
      equity: 10000,
      margin: 0,
      freeMargin: 10000,
      marginLevel: 0,
      currency: 'USD',
      leverage: 30,
      source: 'error_fallback',
      error: error.message
    };
  }
}

  /**
   * Récupère l'état actuel du compte MT4
   */
  /*async getAccountState() {
    // Récupérer le dernier état enregistré
    const lastState = await this.prisma.accountState.findFirst({
      orderBy: { lastUpdate: 'desc' }
    });

    // Si trop ancien (> 1 minute), demander une mise à jour à MT4
    if (!lastState || Date.now() - lastState.lastUpdate.getTime() > 60000) {
      console.log('[RiskManager] État du compte trop ancien, mise à jour requise');
    }

    return lastState || {
      balance: 10000,    // Valeurs par défaut pour les tests
      equity: 10000,
      margin: 0,
      freeMargin: 10000,
      marginLevel: 0
    };
  }*/

    /**
 * NOUVELLE MÉTHODE : Force la mise à jour de l'état du compte
 */
async forceAccountRefresh() {
  console.log('[RiskManager] Force refresh demandé...');
  
  if (this.mt4Connector && this.mt4Connector.refreshAccountInfo) {
    try {
      await this.mt4Connector.refreshAccountInfo(true); // Force refresh
      return await this.getAccountState();
    } catch (error) {
      console.warn('[RiskManager] Erreur force refresh:', error.message);
    }
  }
  
  return await this.getAccountState();
}

/**
 * NOUVELLE MÉTHODE : Vérifie la fraîcheur des données de compte
 */
async isAccountDataFresh(maxAgeMinutes = 2) {
  try {
    const lastState = await this.prisma.accountState.findFirst({
      orderBy: { lastUpdate: 'desc' }
    });
    
    if (!lastState) return false;
    
    const ageMinutes = (Date.now() - lastState.lastUpdate.getTime()) / 60000;
    return ageMinutes <= maxAgeMinutes;
  } catch (error) {
    console.warn('[RiskManager] Erreur vérification fraîcheur:', error.message);
    return false;
  }
}

  /**
   * Enregistre les métriques de risk simplifiées
   */
  async recordRiskMetrics(orderId, accountState) {
    // Calculer uniquement les métriques essentielles
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

    // PnL quotidien uniquement
    const dailyPnL = await this.calculatePeriodPnL('day');

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
        weeklyPnL: 0, // Simplifié
        monthlyPnL: 0 // Simplifié
      }
    });
  }

  /**
   * Calcule le P&L pour une période donnée
   */
  async calculatePeriodPnL(period) {
    const startDate = new Date();
    
    if (period === 'day') {
      startDate.setHours(0, 0, 0, 0);
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
   * Vérifie si le trading est autorisé (horaires uniquement)
   */
  async isTradingAllowed(symbol, riskConfig) {
    const now = new Date();
    
    // Vérifier uniquement les horaires de trading si configurés
    if (riskConfig.tradingHours) {
      try {
        const hours = JSON.parse(riskConfig.tradingHours);
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 100 + currentMinute; // Format HHMM
        
        // Format attendu: {"start": "0800", "end": "2200"} ou {"start": 800, "end": 2200}
        const startTime = typeof hours.start === 'string' ? parseInt(hours.start) : hours.start;
        const endTime = typeof hours.end === 'string' ? parseInt(hours.end) : hours.end;
        
        if (startTime && endTime) {
          if (currentTime < startTime || currentTime > endTime) {
            return { 
              allowed: false, 
              reason: `Hors horaires de trading (${startTime}-${endTime}, actuel: ${currentTime})` 
            };
          }
        }
      } catch (error) {
        console.warn('[RiskManager] Erreur parsing tradingHours:', error);
      }
    }

    return { allowed: true };
  }

  /**
   * Enregistre une entrée dans le log d'audit
   */
  async logAudit(action, entityType, entityId, details, severity = 'INFO') {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entityType,
          entityId,
          details: JSON.stringify(details),
          severity
        }
      });
    } catch (error) {
      console.error('[RiskManager] Erreur log audit:', error);
    }
  }

  /**
   * Nettoie les ressources
   */
  async cleanup() {
    await this.prisma.$disconnect();
  }
}

module.exports = RiskManager;