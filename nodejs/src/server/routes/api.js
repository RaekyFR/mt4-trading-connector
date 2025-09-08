// nodejs/src/server/routes/api.js
const express = require('express');
const router = express.Router();

// ==================== ACCOUNT ====================

/**
 * GET /api/account/state
 * Récupère l'état actuel du compte
 */
router.get('/account/state', async (req, res) => {
  try {
    // Récupérer depuis la DB
    const dbState = await req.prisma.accountState.findFirst({
      orderBy: { lastUpdate: 'desc' }
    });
    //console.log('🔍 [DEBUG] DB state:', JSON.stringify(dbState, null, 2));

    // Essayer de récupérer l'état en temps réel depuis MT4
    let mt4State = null;
    try {
      const balanceResult = await req.mt4Connector.getBalance();
  //    console.log('[DEBUG] MT4 balanceResult:', JSON.stringify(balanceResult, null, 2));
      // APRÈS cette ligne : const balanceResult = await req.mt4Connector.getBalance();
      //console.log('🔍 [DEBUG] MT4 balanceResult complet:', JSON.stringify(balanceResult, null, 2));
      if (balanceResult.success) {
        mt4State = balanceResult;
        
        // Mettre à jour la DB
        await req.prisma.accountState.create({
          data: {
                balance: balanceResult.balance || 0,
                equity: balanceResult.equity || balanceResult.balance || 0,
                margin: balanceResult.margin || 0,
                freeMargin: balanceResult.freeMargin || (balanceResult.balance || 0),
                marginLevel: balanceResult.marginLevel || 0
          }
        });
      }
    } catch (error) {
      console.error('[API] Erreur récupération MT4:', error);
      
    }
const responseData = {
    current: mt4State || dbState,
    lastUpdate: dbState?.lastUpdate,
    isRealTime: !!mt4State
};
//console.log('🔍 [DEBUG] Response envoyée au frontend:', JSON.stringify(responseData, null, 2));

res.json(responseData);
   /* res.json({
      current: mt4State || dbState,
      lastUpdate: dbState?.lastUpdate,
      isRealTime: !!mt4State
    });*/

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/account/metrics
 * Récupère les métriques de performance
 */
router.get('/account/metrics', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    // Calculer la date de début selon la période
    const startDate = new Date();
    switch(period) {
      case '1d': startDate.setDate(startDate.getDate() - 1); break;
      case '7d': startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setDate(startDate.getDate() - 30); break;
      case 'all': startDate.setFullYear(2000); break;
    }

    // Statistiques des ordres
    const orderStats = await req.prisma.order.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: startDate }
      },
      _count: true
    });

    // Calcul du P&L
    const profitLoss = await req.prisma.order.aggregate({
      where: {
        status: 'CLOSED',
        closeTime: { gte: startDate }
      },
      _sum: { profit: true },
      _count: true
    });

    // Trades gagnants/perdants
    const winningTrades = await req.prisma.order.count({
      where: {
        status: 'CLOSED',
        closeTime: { gte: startDate },
        profit: { gt: 0 }
      }
    });

    const totalClosedTrades = profitLoss._count || 0;
    const winRate = totalClosedTrades > 0 
      ? (winningTrades / totalClosedTrades) * 100 
      : 0;

    // Risk metrics
    const latestRiskMetric = await req.prisma.riskMetric.findFirst({
      orderBy: { timestamp: 'desc' }
    });

    res.json({
      period,
      orderStats,
      profitLoss: {
        total: profitLoss._sum.profit || 0,
        trades: totalClosedTrades,
        winRate: winRate.toFixed(2)
      },
      currentRisk: {
        openPositions: latestRiskMetric?.openPositions || 0,
        totalExposure: latestRiskMetric?.totalExposure || 0,
        totalRisk: latestRiskMetric?.totalRisk || 0,
        dailyPnL: latestRiskMetric?.dailyPnL || 0
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STRATEGIES ====================

/**
 * GET /api/strategies
 * Liste toutes les stratégies
 */
router.get('/strategies', async (req, res) => {
  try {
    const strategies = await req.prisma.strategy.findMany({
      include: {
        _count: {
          select: {
            signals: true,
            orders: true
          }
        }
      }
    });

    res.json(strategies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/strategies
 * Crée une nouvelle stratégie
 */
router.post('/strategies', async (req, res) => {
  try {
    const strategy = await req.prisma.strategy.create({
      data: req.body
    });

    res.json(strategy);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/strategies/:id
 * Met à jour une stratégie
 */
router.put('/strategies/:id', async (req, res) => {
  try {
    const strategy = await req.prisma.strategy.update({
      where: { id: req.params.id },
      data: req.body
    });

    res.json(strategy);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


/**
 * GET /api/strategies/:id
 * Récupère une stratégie spécifique avec tous ses détails
 */
router.get('/strategies/:id', async (req, res) => {
  try {
    const strategy = await req.prisma.strategy.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            signals: true,
            orders: true
          }
        },
        riskConfigs: {
          where: { isActive: true },
          take: 1
        },
        // Statistiques récentes
        signals: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 derniers jours
            }
          },
          select: {
            id: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!strategy) {
      return res.status(404).json({ error: 'Stratégie non trouvée' });
    }

    // Calculer les statistiques
    const stats = {
      totalSignals: strategy._count.signals,
      totalOrders: strategy._count.orders,
      recentSignals: strategy.signals.length,
      successRate: strategy.signals.length > 0 ? 
        (strategy.signals.filter(s => s.status === 'PROCESSED').length / strategy.signals.length * 100).toFixed(1) : 0
    };

    // Nettoyer les données pour la réponse
    const { signals, ...strategyData } = strategy;
    strategyData.stats = stats;

    res.json(strategyData);

  } catch (error) {
    console.error('[API] Erreur récupération stratégie:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/strategies/:id
 * Supprime une stratégie et ses données associées
 */
router.delete('/strategies/:id', async (req, res) => {
  try {
    const strategyId = req.params.id;

    // Vérifier que la stratégie existe
    const strategy = await req.prisma.strategy.findUnique({
      where: { id: strategyId },
      include: {
        _count: {
          select: {
            signals: true,
            orders: true
          }
        }
      }
    });

    if (!strategy) {
      return res.status(404).json({ error: 'Stratégie non trouvée' });
    }

    // Vérifier s'il y a des ordres ouverts pour cette stratégie
    const openOrders = await req.prisma.order.count({
      where: {
        strategyId: strategyId,
        status: { in: ['PLACED', 'FILLED', 'PARTIAL'] }
      }
    });

    if (openOrders > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer la stratégie',
        reason: `${openOrders} ordre(s) encore ouvert(s). Fermez-les d'abord.`
      });
    }

    // Supprimer dans l'ordre (contraintes FK)
    await req.prisma.$transaction(async (tx) => {
      // Supprimer les risk metrics liées aux ordres de cette stratégie
      await tx.riskMetric.deleteMany({
        where: {
          order: {
            strategyId: strategyId
          }
        }
      });

      // Supprimer les ordres fermés de la stratégie
      await tx.order.deleteMany({
        where: { strategyId: strategyId }
      });

      // Supprimer les signaux de la stratégie
      await tx.signal.deleteMany({
        where: { strategyId: strategyId }
      });

      // Supprimer les configurations de risque
      await tx.riskConfig.deleteMany({
        where: { strategyId: strategyId }
      });

      // Supprimer la stratégie
      await tx.strategy.delete({
        where: { id: strategyId }
      });
    });

    // Log de l'action
    await req.prisma.auditLog.create({
      data: {
        action: 'STRATEGY_DELETED',
        entityType: 'STRATEGY',
        entityId: strategyId,
        severity: 'INFO',
        details: JSON.stringify({
          strategyName: strategy.name,
          deletedSignals: strategy._count.signals,
          deletedOrders: strategy._count.orders
        })
      }
    });

    res.json({
      success: true,
      message: `Stratégie "${strategy.name}" supprimée avec succès`,
      deletedData: {
        signals: strategy._count.signals,
        orders: strategy._count.orders
      }
    });

  } catch (error) {
    console.error('[API] Erreur suppression stratégie:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/strategies/:id/toggle
 * Active/désactive une stratégie
 */
router.put('/strategies/:id/toggle', async (req, res) => {
  try {
    const strategy = await req.prisma.strategy.findUnique({
      where: { id: req.params.id }
    });

    if (!strategy) {
      return res.status(404).json({ error: 'Stratégie non trouvée' });
    }

    const updatedStrategy = await req.prisma.strategy.update({
      where: { id: req.params.id },
      data: { isActive: !strategy.isActive }
    });

    // Log de l'action
    await req.prisma.auditLog.create({
      data: {
        action: strategy.isActive ? 'STRATEGY_DISABLED' : 'STRATEGY_ENABLED',
        entityType: 'STRATEGY',
        entityId: req.params.id,
        severity: 'INFO',
        details: JSON.stringify({
          strategyName: strategy.name,
          newStatus: updatedStrategy.isActive
        })
      }
    });

    res.json({
      success: true,
      strategy: updatedStrategy,
      message: `Stratégie ${updatedStrategy.isActive ? 'activée' : 'désactivée'}`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/strategies/:id/duplicate
 * Duplique une stratégie existante
 */
router.post('/strategies/:id/duplicate', async (req, res) => {
  try {
    const originalStrategy = await req.prisma.strategy.findUnique({
      where: { id: req.params.id }
    });

    if (!originalStrategy) {
      return res.status(404).json({ error: 'Stratégie non trouvée' });
    }

    // Créer le nom de la copie
    const copyName = `${originalStrategy.name}_Copy`;
    
    // Vérifier que le nom n'existe pas déjà
    let finalName = copyName;
    let counter = 1;
    while (await req.prisma.strategy.findUnique({ where: { name: finalName } })) {
      finalName = `${copyName}_${counter}`;
      counter++;
    }

    // Dupliquer la stratégie
    const { id, createdAt, updatedAt, ...strategyData } = originalStrategy;
    const duplicatedStrategy = await req.prisma.strategy.create({
      data: {
        ...strategyData,
        name: finalName,
        description: `Copie de ${originalStrategy.name}`,
        isActive: false // Nouvelle stratégie inactive par défaut
      }
    });

    res.json({
      success: true,
      strategy: duplicatedStrategy,
      message: `Stratégie dupliquée sous le nom "${finalName}"`
    });

  } catch (error) {
    console.error('[API] Erreur duplication stratégie:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/strategies/:id/performance
 * Récupère les métriques de performance d'une stratégie
 */
router.get('/strategies/:id/performance', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculer la date de début
    const startDate = new Date();
    switch(period) {
      case '7d': startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setDate(startDate.getDate() - 30); break;
      case '90d': startDate.setDate(startDate.getDate() - 90); break;
      case '1y': startDate.setFullYear(startDate.getFullYear() - 1); break;
      default: startDate.setDate(startDate.getDate() - 30);
    }

    // Statistiques des signaux
    const signalStats = await req.prisma.signal.groupBy({
      by: ['status'],
      where: {
        strategyId: req.params.id,
        createdAt: { gte: startDate }
      },
      _count: true
    });

    // Statistiques des ordres et P&L
    const orderStats = await req.prisma.order.aggregate({
      where: {
        strategyId: req.params.id,
        closeTime: { gte: startDate },
        status: 'CLOSED'
      },
      _sum: { profit: true },
      _count: true,
      _avg: { profit: true }
    });

    // Ordres gagnants/perdants
    const [winningOrders, losingOrders] = await Promise.all([
      req.prisma.order.count({
        where: {
          strategyId: req.params.id,
          closeTime: { gte: startDate },
          status: 'CLOSED',
          profit: { gt: 0 }
        }
      }),
      req.prisma.order.count({
        where: {
          strategyId: req.params.id,
          closeTime: { gte: startDate },
          status: 'CLOSED',
          profit: { lt: 0 }
        }
      })
    ]);

    // Calcul des métriques
    const totalTrades = orderStats._count || 0;
    const winRate = totalTrades > 0 ? (winningOrders / totalTrades) * 100 : 0;
    const profitFactor = losingOrders > 0 ? 
      Math.abs((orderStats._sum.profit || 0) / losingOrders) : 0;

    res.json({
      period,
      signals: {
        total: signalStats.reduce((sum, stat) => sum + stat._count, 0),
        byStatus: signalStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count;
          return acc;
        }, {})
      },
      trades: {
        total: totalTrades,
        winning: winningOrders,
        losing: losingOrders,
        winRate: winRate.toFixed(1),
        profitFactor: profitFactor.toFixed(2)
      },
      pnl: {
        total: orderStats._sum.profit || 0,
        average: orderStats._avg.profit || 0
      }
    });

  } catch (error) {
    console.error('[API] Erreur performance stratégie:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SIGNALS ====================

/**
 * GET /api/signals
 * Liste les signaux avec filtres
 */
router.get('/signals', async (req, res) => {
  try {
    const { 
      status, 
      strategyId, 
      symbol,
      limit = 50,
      offset = 0 
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (strategyId) where.strategyId = strategyId;
    if (symbol) where.symbol = symbol;

    const [signals, total] = await Promise.all([
      req.prisma.signal.findMany({
        where,
        include: {
          strategy: true,
          orders: true
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      req.prisma.signal.count({ where })
    ]);

    res.json({
      data: signals,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/signals/:id
 * Récupère un signal spécifique
 */
router.get('/signals/:id', async (req, res) => {
  try {
    const signal = await req.prisma.signal.findUnique({
      where: { id: req.params.id },
      include: {
        strategy: true,
        orders: {
          include: {
            riskMetrics: true
          }
        }
      }
    });

    if (!signal) {
      return res.status(404).json({ error: 'Signal non trouvé' });
    }

    res.json(signal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ORDERS ====================

/**
 * GET /api/orders
 * Liste les ordres avec filtres
 */
router.get('/orders', async (req, res) => {
  try {
    const { 
      status, 
      symbol,
      strategyId,
      limit = 50,
      offset = 0 
    } = req.query;

    const where = {};
    // REMPLACER la section where.status :
if (status) {
    // Gérer les status multiples (array ou string)
    if (Array.isArray(status)) {
        where.status = { in: status };
    } else if (typeof status === 'string' && status.includes(',')) {
        // Si c'est une string avec virgules, la split
        where.status = { in: status.split(',') };
    } else {
        where.status = status;
    }
}
  /*  if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }*/
    if (symbol) where.symbol = symbol;
    if (strategyId) where.strategyId = strategyId;

    const [orders, total] = await Promise.all([
      req.prisma.order.findMany({
        where,
        include: {
          signal: true,
          strategy: true
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      req.prisma.order.count({ where })
    ]);

    try {
    // Récupérer les positions MT4
    const mt4Orders = await req.mt4Connector.getOpenOrders();
    console.log('🔍 [DEBUG] MT4 Orders:', JSON.stringify(mt4Orders, null, 2));
    
    if (mt4Orders && mt4Orders.length > 0) {
        const formattedOrders = mt4Orders.map(order => {
            // Convertir le type numérique MT4 en string
            const orderType = order.type === 0 ? 'BUY' :
                             order.type === 1 ? 'SELL' :
                             order.type === 2 ? 'BUY_LIMIT' :
                             order.type === 3 ? 'SELL_LIMIT' :
                             order.type === 4 ? 'BUY_STOP' :
                             order.type === 5 ? 'SELL_STOP' : 'UNKNOWN';
            
            return {
                id: `mt4-${order.ticket}`,
                ticket: order.ticket,
                symbol: order.symbol,
                type: orderType,
                lots: order.lots,
                openPrice: order.openPrice,
                profit: order.profit || 0,
                sl: order.sl || 0,              // 🔧 AJOUTÉ
                tp: order.tp || 0,              // 🔧 AJOUTÉ
                status: 'PLACED',
                createdAt: new Date(),
                strategy: { name: 'MT4' },
                signal: { 
                    action: orderType.includes('BUY') ? 'buy' : 'sell', 
                    symbol: order.symbol 
                }
            };
        });
        
        return res.json({
            data: formattedOrders,
            total: formattedOrders.length,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    }
} catch (error) {
    console.error('[API] Erreur récupération orders MT4:', error);
}

    res.json({
      data: orders,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/orders/close/:ticket
 * Ferme un ordre spécifique
 */
router.post('/orders/close/:ticket', async (req, res) => {
  console.log("api : demande fermeture de ticket :"+parseInt(req.params.ticket));
  try {
    const ticket = parseInt(req.params.ticket);
    /*
    // Vérifier que l'ordre existe
    const order = await req.prisma.order.findUnique({
      where: { ticket }
    });

    if (!order) {
      return res.status(404).json({ error: 'Ordre non trouvé' });
    }

    if (!['PLACED', 'FILLED'].includes(order.status)) {
      console.log("api : deja ferme ticket :"+parseInt(req.params.ticket));
      return res.status(400).json({ error: 'Ordre déjà fermé ou invalide' });
    }*/
 
    // Envoyer la commande de fermeture à MT4
    const result = await req.mt4Connector.closeOrder(ticket);

    if (result.success) {
      // Mettre à jour l'ordre
      await req.prisma.order.update({
        where: { ticket },
        data: {
          status: 'CLOSED',
          closeTime: new Date(),
          closePrice: result.closePrice,
          profit: result.profit
        }
      });

      res.json({
        success: true,
        closePrice: result.closePrice,
        profit: result.profit
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/orders/modify/:ticket
 * Modifie les niveaux SL/TP d'une position
 */
router.post('/orders/modify/:ticket', async (req, res) => {
  try {
    const ticket = parseInt(req.params.ticket);
    const { stopLoss, takeProfit } = req.body;
    
    console.log(`[API] Modification ordre ${ticket} - SL: ${stopLoss}, TP: ${takeProfit}`);

    // Pour les positions MT4 directes, envoyer directement la commande à MT4
    // SANS vérifier en DB car les positions viennent directement de MT4
    const result = await req.mt4Connector.modifyOrder(ticket, stopLoss || 0, takeProfit || 0);

    if (result.success) {
      // Log de l'action (optionnel, sans bloquer si DB indisponible)
      try {
        await req.prisma.auditLog.create({
          data: {
            action: 'MODIFY_ORDER',
            entityType: 'ORDER',
            entityId: `MT4-${ticket}`,
            severity: 'INFO',
            details: `Ticket ${ticket} - SL: ${stopLoss || 'inchangé'}, TP: ${takeProfit || 'inchangé'}`
          }
        });
      } catch (logError) {
        console.warn('[API] Erreur log (ignorée):', logError.message);
      }

      res.json({
        success: true,
        ticket: ticket,
        stopLoss: stopLoss || 0,
        takeProfit: takeProfit || 0,
        message: 'Position modifiée avec succès'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Modification échouée'
      });
    }

  } catch (error) {
    console.error('[API] Erreur modification ordre:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/orders/modify/:ticket
 * Modifie les niveaux SL/TP d'une position
 */
router.post('/orders/modify/:ticket', async (req, res) => {
  try {
    const ticket = parseInt(req.params.ticket);
    const { stopLoss, takeProfit } = req.body;
    
    // Vérifier que l'ordre existe
/*  Pas besoin de verifier l'ordre, il vient de MT4
    const order = await req.prisma.order.findUnique({
      where: { ticket }
    });

    if (!order) {
      return res.status(404).json({ error: 'Ordre non trouvé' });
    }

    if (!['PLACED', 'FILLED'].includes(order.status)) {
      return res.status(400).json({ error: 'Impossible de modifier cet ordre' });
    }*/

    // Envoyer la commande de modification à MT4
    const command = {
      command: 'modifyOrder',
      ticket: ticket,
      stopLoss: stopLoss || 0,
      takeProfit: takeProfit || 0
    };

    const result = await req.mt4Connector.sendCommand(command);

    if (result.success) {
      // Mettre à jour l'ordre en base
      await req.prisma.order.update({
        where: { ticket },
        data: {
          stopLoss: stopLoss || order.stopLoss,
          takeProfit: takeProfit || order.takeProfit,
          updatedAt: new Date()
        }
      });

      // Log de l'action
      await req.prisma.auditLog.create({
        data: {
          action: 'MODIFY_ORDER',
          entityType: 'ORDER',
          entityId: order.id,
          severity: 'INFO',
          details: `SL: ${stopLoss || 'inchangé'}, TP: ${takeProfit || 'inchangé'}`
        }
      });

      res.json({
        success: true,
        stopLoss: stopLoss || order.stopLoss,
        takeProfit: takeProfit || order.takeProfit
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Modification échouée'
      });
    }

  } catch (error) {
    console.error('[API] Erreur modification ordre:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== RISK MANAGEMENT ====================

/**
 * GET /api/risk/config
 * Récupère la configuration de risk
 */
router.get('/risk/config', async (req, res) => {
  try {
    const { strategyId } = req.query;

    const config = await req.prisma.riskConfig.findFirst({
      where: {
        strategyId: strategyId || null,
        isActive: true
      }
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuration non trouvée' });
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/risk/config
 * Met à jour la configuration de risk
 */
router.put('/risk/config', async (req, res) => {
  try {
    const { id, ...data } = req.body;

    const config = await req.prisma.riskConfig.update({
      where: { id },
      data
    });

    res.json(config);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/risk/metrics
 * Récupère les métriques de risk actuelles
 */
router.get('/risk/metrics', async (req, res) => {
  try {
    const latest = await req.prisma.riskMetric.findFirst({
      orderBy: { timestamp: 'desc' },
      include: {
        order: true
      }
    });

    // Historique des métriques (dernières 24h)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const history = await req.prisma.riskMetric.findMany({
      where: {
        timestamp: { gte: yesterday }
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        equity: true,
        totalExposure: true,
        totalRisk: true,
        dailyPnL: true
      }
    });

    res.json({
      current: latest,
      history
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== AUDIT LOGS ====================

/**
 * GET /api/logs
 * Récupère les logs d'audit
 */
router.get('/logs', async (req, res) => {
  try {
    const { 
      severity,
      entityType,
      limit = 100,
      offset = 0 
    } = req.query;

    const where = {};
    if (severity) where.severity = severity;
    if (entityType) where.entityType = entityType;

    const [logs, total] = await Promise.all([
      req.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      req.prisma.auditLog.count({ where })
    ]);

    res.json({
      data: logs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SYSTEM ====================

/**
 * GET /api/system/status
 * Statut global du système
 */
router.get('/system/status', async (req, res) => {
  try {
    const mt4Connected = req.mt4Connector.isConnected;
    
    // Compter les signaux en attente
    const pendingSignals = await req.prisma.signal.count({
      where: { status: 'VALIDATED' }
    });

    // Positions ouvertes
    const openPositions = await req.prisma.order.count({
      where: { status: { in: ['PLACED', 'FILLED'] } }
    });

    // Dernière activité
    const lastSignal = await req.prisma.signal.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    const lastOrder = await req.prisma.order.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      status: 'running',
      mt4Connected,
      signalProcessor: {
        running: true,
        pendingSignals
      },
      positions: {
        open: openPositions
      },
      lastActivity: {
        signal: lastSignal?.createdAt,
        order: lastOrder?.createdAt
      },
      uptime: process.uptime()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/system/restart
 * Redémarre les composants
 */
router.post('/system/restart', async (req, res) => {
  try {
    const { component } = req.body;

    if (component === 'mt4' || !component) {
      await req.mt4Connector.stop();
      await req.mt4Connector.start();
    }

    if (component === 'signals' || !component) {
      req.signalProcessor.stop();
      req.signalProcessor.start();
    }

    res.json({
      success: true,
      message: `Composant(s) redémarré(s): ${component || 'tous'}`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;