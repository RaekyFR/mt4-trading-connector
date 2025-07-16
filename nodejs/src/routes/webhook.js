// nodejs/src/server/routes/webhook.js
const express = require('express');
const router = express.Router();
const config = require('../../../config');

/**
 * POST /webhook/tradingview
 * Reçoit les signaux de TradingView
 */
router.post('/tradingview', async (req, res) => {
  try {
    // Vérifier le secret si configuré
    if (config.webhook.secret) {
      const providedSecret = req.headers['x-webhook-secret'] || req.query.secret;
      if (providedSecret !== config.webhook.secret) {
        console.warn('[Webhook] Tentative avec secret invalide');
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    console.log('[Webhook] Signal reçu:', JSON.stringify(req.body, null, 2));

    // Validation basique du signal
    const { strategy, action, symbol } = req.body;
    
    if (!strategy || !action || !symbol) {
      return res.status(400).json({ 
        error: 'Signal invalide',
        required: ['strategy', 'action', 'symbol']
      });
    }

    // Normaliser l'action
    const normalizedAction = action.toLowerCase();
    if (!['buy', 'sell', 'close'].includes(normalizedAction)) {
      return res.status(400).json({ 
        error: 'Action invalide',
        valid: ['buy', 'sell', 'close']
      });
    }

    // Vérifier que la stratégie existe
    const strategyExists = await req.prisma.strategy.findUnique({
      where: { name: strategy }
    });

    if (!strategyExists) {
      // Créer la stratégie si elle n'existe pas
      console.log(`[Webhook] Création de la stratégie: ${strategy}`);
      await req.prisma.strategy.create({
        data: {
          name: strategy,
          description: `Stratégie créée automatiquement depuis webhook`,
          isActive: true,
          maxDailyLoss: 5.0,
          maxPositions: 3,
          maxLotSize: 0.5,
          defaultRiskPercent: 1.0,
          allowedSymbols: JSON.stringify([symbol])
        }
      });
    }

    // Valider le signal avec le Risk Manager
    const validationResult = await req.riskManager.validateSignal({
      ...req.body,
      action: normalizedAction,
      source: 'tradingview'
    });

    if (validationResult.success) {
      res.json({
        success: true,
        message: 'Signal accepté et en cours de traitement',
        signalId: validationResult.signal.id,
        lotSize: validationResult.lotSize,
        riskAmount: validationResult.riskAmount
      });
    } else {
      res.status(422).json({
        success: false,
        error: validationResult.error,
        message: 'Signal rejeté par le Risk Manager'
      });
    }

    // Logger l'événement
    await req.prisma.auditLog.create({
      data: {
        action: 'webhook_signal_received',
        entityType: 'signal',
        entityId: validationResult.signal?.id,
        details: JSON.stringify({
          ...req.body,
          validation: validationResult
        }),
        severity: validationResult.success ? 'INFO' : 'WARNING'
      }
    });

  } catch (error) {
    console.error('[Webhook] Erreur:', error);
    
    await req.prisma.auditLog.create({
      data: {
        action: 'webhook_error',
        entityType: 'system',
        details: JSON.stringify({
          error: error.message,
          body: req.body
        }),
        severity: 'ERROR'
      }
    });

    res.status(500).json({ 
      error: 'Erreur serveur',
      message: config.debug ? error.message : undefined
    });
  }
});

/**
 * GET /webhook/test
 * Page de test pour envoyer des signaux manuellement
 */
router.get('/test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Webhook TradingView</title>
      <style>
        body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 8px; }
        button { background: #4CAF50; color: white; padding: 10px 20px; border: none; cursor: pointer; }
        button:hover { background: #45a049; }
        #response { margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px; }
        .error { color: red; }
        .success { color: green; }
      </style>
    </head>
    <body>
      <h1>Test Webhook TradingView</h1>
      
      <form id="webhookForm">
        <div class="form-group">
          <label>Stratégie:</label>
          <input type="text" name="strategy" value="Default" required>
        </div>
        
        <div class="form-group">
          <label>Action:</label>
          <select name="action" required>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="close">Close</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Symbole:</label>
          <select name="symbol">
            <option value="EURUSD">EURUSD</option>
            <option value="GBPUSD">GBPUSD</option>
            <option value="BTCUSD">BTCUSD</option>
            <option value="XAUUSD">XAUUSD</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Prix (optionnel):</label>
          <input type="number" name="price" step="0.00001">
        </div>
        
        <div class="form-group">
          <label>Stop Loss (optionnel):</label>
          <input type="number" name="stopLoss" step="0.00001">
        </div>
        
        <div class="form-group">
          <label>Take Profit (optionnel):</label>
          <input type="number" name="takeProfit" step="0.00001">
        </div>
        
        <div class="form-group">
          <label>Lot (optionnel):</label>
          <input type="number" name="lot" step="0.01" value="0.1">
        </div>
        
        <div class="form-group">
          <label>Secret (si configuré):</label>
          <input type="text" name="secret" placeholder="Laisser vide si pas de secret">
        </div>
        
        <button type="submit">Envoyer Signal</button>
      </form>
      
      <div id="response"></div>
      
      <script>
        document.getElementById('webhookForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const formData = new FormData(e.target);
          const data = {};
          const secret = formData.get('secret');
          
          // Construire le payload
          for (let [key, value] of formData.entries()) {
            if (value && key !== 'secret') {
              if (['price', 'stopLoss', 'takeProfit', 'lot'].includes(key)) {
                data[key] = parseFloat(value);
              } else {
                data[key] = value;
              }
            }
          }
          
          const responseDiv = document.getElementById('response');
          responseDiv.innerHTML = 'Envoi en cours...';
          
          try {
            const headers = { 'Content-Type': 'application/json' };
            if (secret) {
              headers['X-Webhook-Secret'] = secret;
            }
            
            const response = await fetch('/webhook/tradingview', {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
              responseDiv.innerHTML = '<div class="success">✅ ' + JSON.stringify(result, null, 2) + '</div>';
            } else {
              responseDiv.innerHTML = '<div class="error">❌ ' + JSON.stringify(result, null, 2) + '</div>';
            }
          } catch (error) {
            responseDiv.innerHTML = '<div class="error">❌ Erreur: ' + error.message + '</div>';
          }
        });
      </script>
    </body>
    </html>
  `);
});

module.exports = router;