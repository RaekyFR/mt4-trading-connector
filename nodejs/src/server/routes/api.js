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
 * POST /api/orders/close-all
 * Ferme toutes les positions ouvertes
 */
router.post('/orders/close-all', async (req, res) => {
  try {
    console.log('[API] Demande fermeture de toutes les positions');
    
    // Envoyer la commande directement à MT4 pour qu'il ferme tout
    const result = await req.mt4Connector.closeAllOrders();

    if (result.success) {
      // Log de l'action
      await req.prisma.auditLog.create({
        data: {
          action: 'CLOSE_ALL_ORDERS',
          entityType: 'ORDER',
          entityId: 'ALL',
          severity: 'INFO',
          details: `Fermeture de toutes les positions demandée`
        }
      }).catch(() => {}); // Ignorer l'erreur de log

      res.json({
        success: true,
        message: 'Toutes les positions ont été fermées',
        closedCount: result.closedCount || 0,
        totalCount: result.totalCount || 0
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Échec fermeture positions'
      });
    }

  } catch (error) {
    console.error('[API] Erreur fermeture toutes positions:', error);
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
    
    // Vérifier que l'ordre existe
    const order = await req.prisma.order.findUnique({
      where: { ticket }
    });

    if (!order) {
      return res.status(404).json({ error: 'Ordre non trouvé' });
    }

    if (!['PLACED', 'FILLED'].includes(order.status)) {
      return res.status(400).json({ error: 'Impossible de modifier cet ordre' });
    }

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