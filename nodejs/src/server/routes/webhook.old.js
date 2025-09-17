// nodejs/src/routes/webhook.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

/**
 * POST /webhook/tradingview
 * Reçoit les signaux de TradingView et les traite
 */
router.post('/tradingview', async (req, res) => {
  try {
    console.log('[Webhook] Signal TradingView reçu:', JSON.stringify(req.body, null, 2));

    // 1. Vérifier le secret si configuré (optionnel pour commencer)
    if (process.env.TRADINGVIEW_WEBHOOK_SECRET) {
      const providedSecret = req.headers['x-webhook-secret'] || req.query.secret;
      if (providedSecret !== process.env.TRADINGVIEW_WEBHOOK_SECRET) {
        console.warn('[Webhook] Tentative avec secret invalide');
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // 2. Validation du format TradingView
    const { signal, symbol, direction, stop_loss } = req.body;
    
    if (!signal || !symbol || !direction) {
      return res.status(400).json({ 
        error: 'Signal TradingView invalide',
        required: ['signal', 'symbol', 'direction'],
        received: req.body
      });
    }

    // 3. Normaliser les données pour le RiskManager
    const normalizedDirection = direction.toString().toUpperCase();
    if (!['BUY', 'SELL', '1', '-1'].includes(normalizedDirection)) {
      return res.status(400).json({ 
        error: 'Direction invalide',
        valid: ['BUY', 'SELL', '1', '-1'],
        received: direction
      });
    }

    // Convertir direction en action standardisée
    let action;
    if (normalizedDirection === 'BUY' || normalizedDirection === '1') {
      action = 'buy';
    } else if (normalizedDirection === 'SELL' || normalizedDirection === '-1') {
      action = 'sell';
    }

    // 4. Vérifier que la stratégie existe (pas de création automatique)
    const strategy = await req.prisma.strategy.findUnique({
      where: { name: signal },
      include: { riskConfigs: { where: { isActive: true } } }
    });

    if (!strategy) {
      console.log(`[Webhook] Stratégie inconnue: ${signal} - Signal ignoré`);
      
      // Logger la tentative
      await req.prisma.auditLog.create({
        data: {
          action: 'UNKNOWN_STRATEGY',
          entityType: 'SIGNAL',
          entityId: null,
          details: JSON.stringify({
            strategy: signal,
            symbol: symbol,
            direction: direction,
            message: 'Stratégie non configurée en base'
          }),
          severity: 'WARNING'
        }
      });

      // Réponse silencieuse (pas d'erreur HTTP)
      return res.json({
        success: true,
        message: `Signal ignoré - Stratégie ${signal} non configurée`,
        action: 'ignored'
      });
    }

    // 5. Vérifier si la stratégie est active
    if (!strategy.isActive) {
      console.log(`[Webhook] Stratégie ${signal} inactive`);
      return res.status(422).json({
        success: false,
        error: `Stratégie ${signal} inactive`,
        message: 'Signal ignoré'
      });
    }

    // 6. Construire le signal enrichi pour le RiskManager
    const enrichedSignal = {
      strategy: signal,
      action: action,
      symbol: symbol,
      stopLoss: stop_loss,
      price: req.body.entry_price || null, // Prix d'entrée si fourni
      source: 'tradingview',
      rawData: req.body
    };

    // 7. Valider avec le RiskManager
    console.log(`[Webhook] Validation du signal avec RiskManager...`);
    const validationResult = await req.riskManager.validateSignal(enrichedSignal);

    if (!validationResult.success) {
      console.log(`[Webhook] Signal rejeté: ${validationResult.error}`);
      
      // Logger le rejet
      await req.prisma.auditLog.create({
        data: {
          action: 'SIGNAL_REJECTED',
          entityType: 'SIGNAL',
          entityId: null,
          details: JSON.stringify({
            reason: validationResult.error,
            signal: enrichedSignal
          }),
          severity: 'WARNING'
        }
      });

      return res.status(422).json({
        success: false,
        error: validationResult.error,
        message: 'Signal rejeté par le Risk Manager'
      });
    }

    // 8. Signal validé - prêt pour traitement
    console.log(`[Webhook] Signal validé - ID: ${validationResult.signal.id}, Lot: ${validationResult.lotSize}`);

    // Logger l'acceptation
    await req.prisma.auditLog.create({
      data: {
        action: 'SIGNAL_ACCEPTED',
        entityType: 'SIGNAL',
        entityId: validationResult.signal.id,
        details: JSON.stringify({
          signal: enrichedSignal,
          calculatedLot: validationResult.lotSize,
          riskAmount: validationResult.riskAmount
        }),
        severity: 'INFO'
      }
    });

    // 9. Réponse de succès
    res.json({
      success: true,
      message: 'Signal accepté et en cours de traitement',
      signalId: validationResult.signal.id,
      strategy: signal,
      action: action,
      symbol: symbol,
      calculatedLot: validationResult.lotSize,
      riskAmount: validationResult.riskAmount,
      status: 'VALIDATED'
    });

  } catch (error) {
    console.error('[Webhook] Erreur traitement:', error);
    
    // Logger l'erreur
    try {
      await req.prisma.auditLog.create({
        data: {
          action: 'WEBHOOK_ERROR',
          entityType: 'SYSTEM',
          entityId: 'tradingview',
          details: JSON.stringify({
            error: error.message,
            stack: error.stack,
            body: req.body
          }),
          severity: 'ERROR'
        }
      });
    } catch (logError) {
      console.error('[Webhook] Erreur logging:', logError);
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur',
      message: 'Signal non traité'
    });
  }
});

/**
 * GET /webhook/test
 * Interface de test pour simuler les signaux TradingView
 */
router.get('/test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Webhook TradingView</title>
      <meta charset="utf-8">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 900px; 
          margin: 40px auto; 
          padding: 20px;
          background: #f5f7fa;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #2c3e50; margin-bottom: 30px; }
        .form-group { 
          margin: 20px 0;
          display: flex;
          flex-direction: column;
        }
        label { 
          display: block; 
          margin-bottom: 8px; 
          font-weight: 600;
          color: #34495e;
        }
        input, select, textarea { 
          width: 100%; 
          padding: 12px;
          border: 2px solid #e1e8ed;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.3s;
        }
        input:focus, select:focus { 
          outline: none;
          border-color: #3498db;
        }
        button { 
          background: #27ae60;
          color: white; 
          padding: 12px 24px; 
          border: none; 
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: background 0.3s;
        }
        button:hover { background: #229954; }
        button:disabled { background: #bdc3c7; cursor: not-allowed; }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        #response { 
          margin-top: 30px; 
          padding: 20px; 
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          white-space: pre-wrap;
          display: none;
        }
        .success { 
          background: #d5f4e6; 
          border: 1px solid #27ae60;
          color: #155724;
        }
        .error { 
          background: #f8d7da; 
          border: 1px solid #dc3545;
          color: #721c24;
        }
        .loading { 
          background: #d1ecf1; 
          border: 1px solid #17a2b8;
          color: #0c5460;
        }
        .preset {
          background: #e8f4f8;
          padding: 15px;
          border-radius: 6px;
          margin: 15px 0;
        }
        .preset button {
          background: #17a2b8;
          padding: 8px 16px;
          margin: 5px;
          font-size: 14px;
        }
        .preset button:hover { background: #138496; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎯 Test Webhook TradingView</h1>
        
        <div class="preset">
          <h3>Signaux prédéfinis :</h3>
          <button onclick="loadPreset('fvg_buy')">FVG Entry BUY EURUSD</button>
          <button onclick="loadPreset('fvg_sell')">FVG Entry SELL GBPUSD</button>
          <button onclick="loadPreset('scalp_buy')">Scalp BUY BTCUSD</button>
        </div>
        
        <form id="webhookForm">
          <div class="form-row">
            <div class="form-group">
              <label>Signal (nom stratégie) :</label>
              <input type="text" name="signal" value="FVG_ENTRY" required>
            </div>
            
            <div class="form-group">
              <label>Symbol :</label>
              <select name="symbol" required>
                <option value="EURUSD">EURUSD</option>
                <option value="GBPUSD">GBPUSD</option>
                <option value="USDJPY">USDJPY</option>
                <option value="BTCUSD">BTCUSD</option>
                <option value="XAUUSD">XAUUSD</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Direction :</label>
              <select name="direction" required>
                <option value="BUY">BUY (1)</option>
                <option value="SELL">SELL (-1)</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Stop Loss :</label>
              <input type="number" name="stop_loss" step="0.00001" value="1.0800" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Entry Price (optionnel) :</label>
              <input type="number" name="entry_price" step="0.00001" placeholder="Prix d'entrée">
            </div>
            
            <div class="form-group">
              <label>Timeframe :</label>
              <input type="text" name="timeframe" value="15m" placeholder="15m">
            </div>
          </div>
          
          <div class="form-group">
            <label>Secret Webhook (si configuré) :</label>
            <input type="password" name="secret" placeholder="Laisser vide si pas de secret">
          </div>
          
          <button type="submit" id="submitBtn">📤 Envoyer Signal</button>
        </form>
        
        <div id="response"></div>
      </div>
      
      <script>
        // Presets de signaux
        const presets = {
          fvg_buy: {
            signal: 'FVG_ENTRY',
            symbol: 'EURUSD',
            direction: 'BUY',
            stop_loss: 1.0800,
            entry_price: 1.0850,
            timeframe: '15m'
          },
          fvg_sell: {
            signal: 'FVG_ENTRY', 
            symbol: 'GBPUSD',
            direction: 'SELL',
            stop_loss: 1.2650,
            entry_price: 1.2600,
            timeframe: '15m'
          },
          scalp_buy: {
            signal: 'SCALP_STRATEGY',
            symbol: 'BTCUSD',
            direction: 'BUY', 
            stop_loss: 42000,
            entry_price: 42500,
            timeframe: '5m'
          }
        };

        function loadPreset(presetName) {
          const preset = presets[presetName];
          if (!preset) return;
          
          Object.keys(preset).forEach(key => {
            const input = document.querySelector(\`[name="\${key}"]\`);
            if (input) input.value = preset[key];
          });
        }

        document.getElementById('webhookForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const formData = new FormData(e.target);
          const data = {};
          const secret = formData.get('secret');
          
          // Construire le payload au format TradingView
          for (let [key, value] of formData.entries()) {
            if (value && key !== 'secret') {
              if (['entry_price', 'stop_loss'].includes(key)) {
                data[key] = parseFloat(value);
              } else {
                data[key] = value;
              }
            }
          }
          
          // Ajouter timestamp comme TradingView
          data.timestamp = new Date().toISOString();
          
          const responseDiv = document.getElementById('response');
          const submitBtn = document.getElementById('submitBtn');
          
          responseDiv.className = 'loading';
          responseDiv.style.display = 'block';
          responseDiv.textContent = '⏳ Envoi du signal en cours...';
          submitBtn.disabled = true;
          
          try {
            const headers = { 'Content-Type': 'application/json' };
            if (secret) {
              headers['X-Webhook-Secret'] = secret;
            }
            
            console.log('Envoi:', data);
            
            const response = await fetch('/webhook/tradingview', {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
              responseDiv.className = 'success';
              responseDiv.textContent = '✅ Succès:\\n\\n' + JSON.stringify(result, null, 2);
            } else {
              responseDiv.className = 'error';
              responseDiv.textContent = '❌ Erreur:\\n\\n' + JSON.stringify(result, null, 2);
            }
          } catch (error) {
            responseDiv.className = 'error';
            responseDiv.textContent = '❌ Erreur réseau:\\n\\n' + error.message;
          } finally {
            submitBtn.disabled = false;
          }
        });
      </script>
    </body>
    </html>
  `);
});

/**
 * GET /webhook/status
 * Statut du système de webhooks
 */
router.get('/status', async (req, res) => {
  try {
    // Statistiques des dernières 24h
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const stats = {
      signals_received: await req.prisma.signal.count({
        where: { 
          createdAt: { gte: yesterday },
          source: 'tradingview'
        }
      }),
      signals_processed: await req.prisma.signal.count({
        where: { 
          createdAt: { gte: yesterday },
          source: 'tradingview',
          status: { in: ['VALIDATED', 'PROCESSED'] }
        }
      }),
      signals_rejected: await req.prisma.signal.count({
        where: { 
          createdAt: { gte: yesterday },
          source: 'tradingview',
          status: 'REJECTED'
        }
      }),
      active_strategies: await req.prisma.strategy.count({
        where: { isActive: true }
      })
    };
    
    res.json({
      status: 'operational',
      webhook_endpoint: '/webhook/tradingview',
      last_24h: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;