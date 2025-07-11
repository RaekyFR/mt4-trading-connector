// nodejs/src/signals/SignalProcessor.js
const { PrismaClient } = require('@prisma/client');
const RiskManager = require('../risk/RiskManager');
const MT4Connector = require('../mt4/MT4Connector');
const fs = require('fs').promises;
const path = require('path');

class SignalProcessor {
  constructor(config) {
    this.prisma = new PrismaClient();
    this.riskManager = new RiskManager();
    this.mt4Connector = new MT4Connector(config);
    this.processing = false;
    this.processInterval = null;
  }

  /**
   * Démarre le traitement automatique des signaux
   */
  start(intervalMs = 5000) {
    if (this.processInterval) {
      console.log('[SignalProcessor] Déjà démarré');
      return;
    }

    console.log('[SignalProcessor] Démarrage du traitement automatique');
    
    // Traiter immédiatement puis à intervalles réguliers
    this.processSignals();
    this.processInterval = setInterval(() => {
      this.processSignals();
    }, intervalMs);
  }

  /**
   * Arrête le traitement automatique
   */
  stop() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      console.log('[SignalProcessor] Arrêt du traitement');
    }
  }

  /**
   * Traite les signaux en attente
   */
  async processSignals() {
    if (this.processing) {
      console.log('[SignalProcessor] Traitement déjà en cours, skip');
      return;
    }

    this.processing = true;

    try {
      // 1. Récupérer les signaux validés non traités
      const pendingSignals = await this.prisma.signal.findMany({
        where: {
          status: 'VALIDATED',
          processedAt: null
        },
        include: {
          strategy: true
        },
        orderBy: {
          createdAt: 'asc'
        },
        take: 10 // Traiter max 10 signaux à la fois
      });

      if (pendingSignals.length === 0) {
        return;
      }

      console.log(`[SignalProcessor] ${pendingSignals.length} signaux à traiter`);

      // 2. Traiter chaque signal
      for (const signal of pendingSignals) {
        await this.processSingleSignal(signal);
        
        // Pause entre les signaux pour éviter la surcharge
        await this.sleep(500);
      }

    } catch (error) {
      console.error('[SignalProcessor] Erreur générale:', error);
      await this.logError('process_signals_error', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Traite un signal individuel
   */
  async processSingleSignal(signal) {
    console.log(`[SignalProcessor] Traitement signal ${signal.id}`);

    try {
      // 1. Vérifier que le signal est toujours valide
      const currentState = await this.riskManager.getAccountState();
      const riskConfig = await this.getRiskConfig(signal.strategyId);

      // Re-valider avec l'état actuel
      const revalidation = await this.riskManager.riskValidator.checkGlobalLimits(riskConfig);
      if (!revalidation.passed) {
        throw new Error(`Revalidation échouée: ${revalidation.reason}`);
      }

      // 2. Créer l'ordre dans la DB
      const order = await this.prisma.order.create({
        data: {
          signalId: signal.id,
          strategyId: signal.strategyId,
          symbol: signal.symbol,
          type: this.convertSignalType(signal.action, signal.price),
          lots: signal.calculatedLot || 0.01,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          status: 'SENDING',
          riskAmount: signal.riskAmount,
          riskPercent: (signal.riskAmount / currentState.balance) * 100
        }
      });

      // 3. Envoyer à MT4
      const mt4Result = await this.sendOrderToMT4(order, signal);

      // 4. Mettre à jour selon le résultat
      if (mt4Result.success) {
        await this.handleOrderSuccess(order, mt4Result, signal);
      } else {
        await this.handleOrderError(order, mt4Result.error, signal);
      }

    } catch (error) {
      console.error(`[SignalProcessor] Erreur signal ${signal.id}:`, error);
      await this.handleSignalError(signal, error);
    }
  }

  /**
   * Envoie un ordre à MT4
   */
  async sendOrderToMT4(order, signal) {
    try {
      let command;
      
      if (signal.action === 'close') {
        // Fermeture de position
        const openOrder = await this.findOpenOrder(signal.symbol, signal.strategyId);
        if (!openOrder || !openOrder.ticket) {
          throw new Error('Aucune position ouverte à fermer');
        }

        command = {
          id: `order-${order.id}`,
          command: 'closeMarketOrder',
          ticket: openOrder.ticket
        };

      } else if (signal.price) {
        // Ordre limite/stop
        command = {
          id: `order-${order.id}`,
          command: 'limitOrder',
          symbol: order.symbol,
          type: `${signal.action} ${this.getOrderTypeModifier(signal)}`,
          lot: order.lots,
          price: signal.price,
          sl: order.stopLoss,
          tp: order.takeProfit,
          comment: `Signal-${signal.id}`
        };

      } else {
        // Ordre au marché
        command = {
          id: `order-${order.id}`,
          command: 'marketOrder',
          symbol: order.symbol,
          type: signal.action,
          lot: order.lots,
          sl: order.stopLoss,
          tp: order.takeProfit,
          comment: `Signal-${signal.id}`
        };
      }

      // Envoyer via MT4Connector
      const result = await this.mt4Connector.sendCommand(command);
      
      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Gère le succès d'un ordre
   */
  async handleOrderSuccess(order, mt4Result, signal) {
    // Mettre à jour l'ordre
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        ticket: mt4Result.ticket,
        status: 'PLACED',
        openPrice: mt4Result.price,
        openTime: new Date(),
        mt4Status: 'success'
      }
    });

    // Mettre à jour le signal
    await this.prisma.signal.update({
      where: { id: signal.id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date()
      }
    });

    // Logger le succès
    await this.prisma.auditLog.create({
      data: {
        action: 'order_placed',
        entityType: 'order',
        entityId: order.id,
        details: JSON.stringify({
          ticket: mt4Result.ticket,
          price: mt4Result.price,
          lots: order.lots
        }),
        severity: 'INFO'
      }
    });

    console.log(`[SignalProcessor] ✅ Ordre placé: Ticket ${mt4Result.ticket}`);
  }

  /**
   * Gère l'erreur d'un ordre
   */
  async handleOrderError(order, error, signal) {
    // Mettre à jour l'ordre
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'ERROR',
        errorMessage: error,
        mt4Status: 'error'
      }
    });

    // Incrémenter le compteur de retry si applicable
    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        retryCount: { increment: 1 }
      }
    });

    // Si moins de 3 essais, remettre en PENDING pour retry
    if (updatedOrder.retryCount < 3) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'PENDING' }
      });
    } else {
      // Marquer le signal comme en erreur après 3 essais
      await this.prisma.signal.update({
        where: { id: signal.id },
        data: {
          status: 'ERROR',
          errorMessage: `Échec après ${updatedOrder.retryCount} tentatives: ${error}`
        }
      });
    }

    // Logger l'erreur
    await this.prisma.auditLog.create({
      data: {
        action: 'order_error',
        entityType: 'order',
        entityId: order.id,
        details: JSON.stringify({ error, retryCount: updatedOrder.retryCount }),
        severity: 'ERROR'
      }
    });
  }

  /**
   * Gère l'erreur d'un signal
   */
  async handleSignalError(signal, error) {
    await this.prisma.signal.update({
      where: { id: signal.id },
      data: {
        status: 'ERROR',
        errorMessage: error.message,
        processedAt: new Date()
      }
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'signal_processing_error',
        entityType: 'signal',
        entityId: signal.id,
        details: JSON.stringify({ error: error.message }),
        severity: 'ERROR'
      }
    });
  }

  /**
   * Trouve une position ouverte pour fermeture
   */
  async findOpenOrder(symbol, strategyId) {
    return await this.prisma.order.findFirst({
      where: {
        symbol,
        strategyId,
        status: { in: ['PLACED', 'FILLED'] },
        ticket: { not: null }
      },
      orderBy: { openTime: 'desc' }
    });
  }

  /**
   * Convertit le type de signal en type d'ordre MT4
   */
  convertSignalType(action, hasPrice) {
    if (action === 'buy') {
      return hasPrice ? 'BUY_LIMIT' : 'BUY';
    } else if (action === 'sell') {
      return hasPrice ? 'SELL_LIMIT' : 'SELL';
    }
    return null;
  }

  /**
   * Détermine le modificateur de type d'ordre
   */
  getOrderTypeModifier(signal) {
    if (!signal.price) return '';
    
    // Si le prix est meilleur que le marché actuel → limit
    // Sinon → stop
    // TODO: Implémenter la logique de comparaison avec le prix actuel
    return 'limit';
  }

  /**
   * Récupère la configuration de risk pour une stratégie
   */
  async getRiskConfig(strategyId) {
    const config = await this.prisma.riskConfig.findFirst({
      where: {
        OR: [
          { strategyId: strategyId },
          { strategyId: null }
        ],
        isActive: true
      },
      orderBy: {
        strategyId: 'desc' // Priorité à la config spécifique
      }
    });

    return config;
  }

  /**
   * Helper pour les délais
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logger les erreurs
   */
  async logError(action, error) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entityType: 'system',
          details: JSON.stringify({
            error: error.message,
            stack: error.stack
          }),
          severity: 'ERROR'
        }
      });
    } catch (e) {
      console.error('[SignalProcessor] Erreur lors du logging:', e);
    }
  }

  /**
   * Nettoie les ressources
   */
  async cleanup() {
    this.stop();
    await this.riskManager.cleanup();
    await this.prisma.$disconnect();
  }
}

module.exports = SignalProcessor;