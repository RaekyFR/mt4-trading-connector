// nodejs/src/server/routes/webhook.js
const express = require('express');
const router = express.Router();
const config = require('../../../config');

// NOUVEAU: Importer le validateur de prix
const PriceValidator = require('../../utils/PriceValidator');
const priceValidator = new PriceValidator();

/**
 * POST /webhook/tradingview
 * Reçoit les signaux de TradingView avec support entry_price/current_price et validation des prix
 */
router.post('/tradingview', async (req, res) => {
  try {
    // Vérifier le secret si configuré
    /*if (config.webhook.secret) {
      const providedSecret = req.headers['x-webhook-secret'] || req.query.secret;
      if (providedSecret !== config.webhook.secret) {
        console.warn('[Webhook] Tentative avec secret invalide');
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }*/

    console.log('[Webhook] Signal TradingView reçu:', JSON.stringify(req.body, null, 2));

    // Validation basique du signal
    const { signal: strategy, action, direction, symbol } = req.body;
    
    if (!strategy && !req.body.strategy) {
      return res.status(400).json({ 
        error: 'Signal invalide - strategy manquant',
        received: Object.keys(req.body)
      });
    }

    if (!symbol) {
      return res.status(400).json({ 
        error: 'Signal invalide - symbol manquant',
        required: ['strategy/signal', 'symbol']
      });
    }

    // NOUVEAU: Validation et correction des prix AVANT normalisation
    let validatedSignal;
    try {
      validatedSignal = priceValidator.validateAndFixPrices(req.body);
      console.log('[Webhook] Signal après validation prix:', validatedSignal);
    } catch (priceError) {
      console.error('[Webhook] Erreur validation prix:', priceError.message);
      return res.status(400).json({
        error: 'Prix invalides détectés',
        details: priceError.message,
        originalPrices: {
          current_price: req.body.current_price,
          entry_price: req.body.entry_price,
          stop_loss: req.body.stop_loss
        }
      });
    }

    // Normaliser l'action depuis direction ou action
    let normalizedAction;
    if (validatedSignal.direction) {
      normalizedAction = validatedSignal.direction.toLowerCase();
    } else if (validatedSignal.action) {
      normalizedAction = validatedSignal.action.toLowerCase();
    } else {
      return res.status(400).json({ 
        error: 'Signal invalide - action/direction manquant',
        required: ['direction ou action']
      });
    }

    if (!['buy', 'sell', 'close'].includes(normalizedAction)) {
      return res.status(400).json({ 
        error: 'Action invalide',
        received: normalizedAction,
        valid: ['buy', 'sell', 'close']
      });
    }

    // Validation des nouveaux champs prix (sur les prix corrigés)
    const entryPrice = validatedSignal.entry_price;
    const currentPrice = validatedSignal.current_price;
    
    // Validation logique market vs limit
    if (!entryPrice || entryPrice === 0) {
      // Ordre MARKET - current_price requis
      if (!currentPrice) {
        return res.status(400).json({
          error: 'current_price requis pour les ordres market',
          details: 'Si entry_price est 0 ou absent, current_price doit être fourni'
        });
      }
    } else {
      // Ordre LIMIT - entry_price doit être valide
      if (typeof entryPrice !== 'number' || entryPrice <= 0) {
        return res.status(400).json({
          error: 'entry_price invalide pour ordre limit',
          received: entryPrice,
          expected: 'nombre > 0'
        });
      }
    }

    // Validation current_price si fourni
    if (currentPrice && (typeof currentPrice !== 'number' || currentPrice <= 0)) {
      return res.status(400).json({
        error: 'current_price invalide',
        received: currentPrice,
        expected: 'nombre > 0'
      });
    }

    // Mapper les champs TradingView vers format interne (utiliser les prix validés)
    const normalizedSignal = {
      strategy: strategy || validatedSignal.strategy,
      action: normalizedAction,
      symbol: validatedSignal.symbol,
      entry_price: validatedSignal.entry_price || 0,
      current_price: validatedSignal.current_price,
      stopLoss: validatedSignal.stop_loss, // Mapper stop_loss -> stopLoss
      takeProfit: validatedSignal.take_profit, // Mapper take_profit -> takeProfit
      lot: validatedSignal.lot,
      timeframe: validatedSignal.timeframe,
      timestamp: validatedSignal.timestamp,
      source: 'tradingview'
    };

    console.log('[Webhook] Signal normalisé:', normalizedSignal);

    // Vérifier que la stratégie existe
    const strategyName = normalizedSignal.strategy;
    const strategyExists = await req.prisma.strategy.findUnique({
      where: { name: strategyName }
    });

    if (!strategyExists) {
      // Créer la stratégie si elle n'existe pas
      console.log(`[Webhook] Création de la stratégie: ${strategyName}`);
      await req.prisma.strategy.create({
        data: {
          name: strategyName,
          description: `Stratégie créée automatiquement depuis webhook`,
          isActive: true,
          maxDailyLoss: 5.0,
          maxPositions: 3,
          maxLotSize: 0.5,
          defaultRiskPercent: 1.0,
          riskRewardRatio: 2.0,
          allowedSymbols: JSON.stringify([validatedSignal.symbol]) // Utiliser le symbole validé
        }
      });
    }

    // Valider le signal avec le Risk Manager
    console.log('[Webhook] Validation du signal avec RiskManager...');
    const validationResult = await req.riskManager.validateSignal(normalizedSignal);

    if (validationResult.success) {
      console.log(`[Webhook] Signal validé - ID: ${validationResult.signal.id}, Lot: ${validationResult.lotSize}`);
      
      // NOUVEAU: Retourner les informations de levier
      const response = {
        success: true,
        message: 'Signal accepté et en cours de traitement',
        signalId: validationResult.signal.id,
        orderType: validationResult.orderType,
        calculationPrice: validationResult.calculationPrice,
        lotSize: validationResult.lotSize,
        riskAmount: validationResult.riskAmount,
        takeProfit: validationResult.takeProfit
      };

      // Ajouter les infos de levier si disponibles
      if (validationResult.leverageInfo) {
        response.leverageInfo = {
          marginUsed: validationResult.leverageInfo.marginUsed,
          leverage: validationResult.leverageInfo.leverage,
          limitedBy: validationResult.leverageInfo.limitedBy
        };
      }

      res.json(response);
    } else {
      console.log(`[Webhook] Signal rejeté: ${validationResult.error}`);
      
      res.status(422).json({
        success: false,
        error: validationResult.error,
        message: 'Signal rejeté par le Risk Manager'
      });
    }

    // Logger l'événement avec métadonnées enrichies
    await req.prisma.auditLog.create({
      data: {
        action: 'webhook_signal_received',
        entityType: 'signal',
        entityId: validationResult.signal?.id,
        details: JSON.stringify({
          originalSignal: req.body,
          validatedPrices: validatedSignal !== req.body ? {
            original: {
              current_price: req.body.current_price,
              entry_price: req.body.entry_price,
              stop_loss: req.body.stop_loss
            },
            corrected: {
              current_price: validatedSignal.current_price,
              entry_price: validatedSignal.entry_price,
              stop_loss: validatedSignal.stop_loss
            }
          } : null,
          normalizedSignal: normalizedSignal,
          validation: {
            success: validationResult.success,
            orderType: validationResult.orderType,
            calculationPrice: validationResult.calculationPrice,
            leverageInfo: validationResult.leverageInfo,
            error: validationResult.error
          }
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
          stack: error.stack,
          body: req.body
        }),
        severity: 'ERROR'
      }
    });

    res.status(500).json({ 
      error: 'Erreur serveur',
      message: config.debug ? error.message : 'Erreur interne'
    });
  }
});

/**
 * GET /webhook/test
 * Page de test mise à jour avec support entry_price/current_price et validation des prix
 */
router.get('/test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Webhook TradingView - Market/Limit Orders avec Levier</title>
      <style>
        body { font-family: Arial; max-width: 900px; margin: 50px auto; padding: 20px; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 8px; box-sizing: border-box; }
        button { background: #4CAF50; color: white; padding: 10px 20px; border: none; cursor: pointer; margin: 5px; }
        button:hover { background: #45a049; }
        .preset-btn { background: #008CBA; }
        .preset-btn:hover { background: #007B9A; }
        #response { margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px; }
        .error { color: red; }
        .success { color: green; }
        .info { background: #e7f3ff; padding: 10px; border-left: 4px solid #2196F3; margin: 10px 0; }
        .warning { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 10px 0; }
        .form-section { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .form-section h3 { margin-top: 0; color: #333; }
        .leverage-info { background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .leverage-value { font-weight: bold; color: #0066cc; }
      </style>
    </head>
    <body>
      <h1>Test Webhook TradingView - Market/Limit Orders avec Levier 30:1</h1>
      
      <div class="info">
        <strong>Nouveautés :</strong><br>
        • <strong>Validation automatique des prix</strong> - Protection contre les erreurs de saisie<br>
        • <strong>Calculs avec levier 30:1</strong> - Optimisation de la marge<br>
        • <strong>Support NASDAQ et S&P500</strong> - Nouveaux symboles disponibles
      </div>
      
      <div class="info">
        <strong>Logique des ordres :</strong><br>
        • <strong>Ordre Market :</strong> entry_price = 0 ou absent + current_price requis<br>
        • <strong>Ordre Limit :</strong> entry_price > 0 (current_price optionnel)
      </div>
      
      <div style="margin: 20px 0;">
        <button type="button" class="preset-btn" onclick="loadPreset('market')">Preset Market Order</button>
        <button type="button" class="preset-btn" onclick="loadPreset('limit')">Preset Limit Order</button>
        <button type="button" class="preset-btn" onclick="loadPreset('nasdaq')">Preset NASDAQ</button>
        <button type="button" class="preset-btn" onclick="loadPreset('sp500')">Preset S&P500</button>
        <button type="button" class="preset-btn" onclick="loadPreset('close')">Preset Close Order</button>
      </div>
      
      <form id="webhookForm">
        <div class="form-section">
          <h3>Signal de base</h3>
          
          <div class="form-group">
            <label>Signal/Stratégie:</label>
            <input type="text" name="signal" value="FVG_ENTRY" required>
          </div>
          
          <div class="form-group">
            <label>Direction:</label>
            <select name="direction" required>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="close">CLOSE</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Symbole:</label>
            <select name="symbol">
              <option value="BTCUSD">BTCUSD</option>
              <option value="EURUSD">EURUSD</option>
              <option value="GBPUSD">GBPUSD</option>
              <option value="XAUUSD">XAUUSD (Gold)</option>
              <option value="US100.cash">NAS100 (NASDAQ)</option>
              <option value="US500.cash">US500 (S&P500)</option>
            </select>
          </div>
        </div>

        <div class="form-section">
          <h3>Prix (Market vs Limit) - Validation automatique</h3>
          
          <div class="form-group">
            <label>Entry Price (0 = Market Order):</label>
            <input type="number" name="entry_price" step="0.00001" placeholder="0 pour ordre market, >0 pour limit">
            <small style="color: #666;">Les prix aberrants seront automatiquement corrigés</small>
          </div>
          
          <div class="form-group">
            <label>Current Price (requis si Market):</label>
            <input type="number" name="current_price" step="0.00001" placeholder="Prix actuel du marché">
          </div>
        </div>

        <div class="form-section">
          <h3>Risk Management avec Levier</h3>
          
          <div class="form-group">
            <label>Stop Loss:</label>
            <input type="number" name="stop_loss" step="0.00001" placeholder="Prix de stop loss">
          </div>
          
          <div class="form-group">
            <label>Take Profit (calculé auto si vide):</label>
            <input type="number" name="take_profit" step="0.00001" placeholder="Laissez vide pour calcul automatique">
          </div>
          
          <div class="form-group">
            <label>Lot (calculé auto avec levier si vide):</label>
            <input type="number" name="lot" step="0.01" placeholder="Taille de position optimisée par le levier">
          </div>
          
          <div class="leverage-info">
            <strong>Levier 30:1 actuel :</strong><br>
            • Marge requise : seulement 3.33% de la valeur de position<br>
            • Optimisation automatique selon votre marge libre<br>
            • Calculs de risque intégrés
          </div>
        </div>

        <div class="form-section">
          <h3>Métadonnées</h3>
          
          <div class="form-group">
            <label>Timeframe:</label>
            <select name="timeframe">
              <option value="h1">H1</option>
              <option value="h4">H4</option>
              <option value="d1">D1</option>
              <option value="m15">M15</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Secret (si configuré):</label>
            <input type="text" name="secret" placeholder="Laisser vide si pas de secret">
          </div>
        </div>
        
        <button type="submit">Envoyer Signal</button>
      </form>
      
      <div id="response"></div>
      
      <script>
        // Presets mis à jour avec les nouveaux symboles
        const presets = {
          market: {
            signal: 'FVG_ENTRY',
            direction: 'BUY',
            symbol: 'BTCUSD',
            entry_price: 0,
            current_price: 58500,
            stop_loss: 57000,
            timeframe: 'h1'
          },
          limit: {
            signal: 'FVG_ENTRY',
            direction: 'BUY', 
            symbol: 'BTCUSD',
            entry_price: 58000,
            current_price: 58500,
            stop_loss: 57000,
            timeframe: 'h1'
          },
          nasdaq: {
            signal: 'INDEX_TRADE',
            direction: 'SELL',
            symbol: 'US100.cash',
            entry_price: 0,
            current_price: 16000,
            stop_loss: 16200,
            timeframe: 'h4'
          },
          sp500: {
            signal: 'INDEX_TRADE',
            direction: 'BUY',
            symbol: 'US500.cash',
            entry_price: 4480,
            current_price: 4500,
            stop_loss: 4450,
            timeframe: 'h4'
          },
          close: {
            signal: 'FVG_EXIT',
            direction: 'close',
            symbol: 'BTCUSD',
            timeframe: 'h1'
          }
        };

        function loadPreset(type) {
          const preset = presets[type];
          const form = document.getElementById('webhookForm');
          
          // Réinitialiser le formulaire
          form.reset();
          
          Object.keys(preset).forEach(key => {
            const input = form.querySelector(\`[name="\${key}"]\`);
            if (input) {
              input.value = preset[key];
            }
          });
        }

        // Validation en temps réel
        document.querySelector('[name="entry_price"]').addEventListener('input', function() {
          const entryPrice = parseFloat(this.value) || 0;
          const currentPriceField = document.querySelector('[name="current_price"]');
          
          if (entryPrice === 0) {
            currentPriceField.style.borderColor = 'red';
            currentPriceField.setAttribute('required', 'required');
            currentPriceField.placeholder = 'REQUIS pour ordre market';
          } else {
            currentPriceField.style.borderColor = '';
            currentPriceField.removeAttribute('required');
            currentPriceField.placeholder = 'Optionnel pour ordre limit';
          }
        });

        document.getElementById('webhookForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const formData = new FormData(e.target);
          const data = {};
          const secret = formData.get('secret');
          
          // Construire le payload
          for (let [key, value] of formData.entries()) {
            if (value && key !== 'secret') {
              if (['entry_price', 'current_price', 'stop_loss', 'take_profit', 'lot'].includes(key)) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  data[key] = numValue;
                }
              } else {
                data[key] = value;
              }
            }
          }

          // Ajouter timestamp
          data.timestamp = new Date().toISOString();
          
          const responseDiv = document.getElementById('response');
          responseDiv.innerHTML = 'Envoi en cours...';
          
          try {
            const headers = { 'Content-Type': 'application/json' };
            if (secret) {
              headers['X-Webhook-Secret'] = secret;
            }
            
            console.log('Payload envoyé:', data);
            
            const response = await fetch('/webhook/tradingview', {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
              let leverageHtml = '';
              if (result.leverageInfo) {
                leverageHtml = \`
                  <div class="leverage-info">
                    <h4>Informations Levier:</h4>
                    <div>Marge utilisée: <span class="leverage-value">$\${result.leverageInfo.marginUsed}</span></div>
                    <div>Levier: <span class="leverage-value">\${result.leverageInfo.leverage}:1</span></div>
                    <div>Limité par: <span class="leverage-value">\${result.leverageInfo.limitedBy}</span></div>
                  </div>
                \`;
              }
              
              responseDiv.innerHTML = '<div class="success">✅ Signal accepté:<br><pre>' + JSON.stringify(result, null, 2) + '</pre>' + leverageHtml + '</div>';
            } else {
              responseDiv.innerHTML = '<div class="error">❌ Signal rejeté:<br><pre>' + JSON.stringify(result, null, 2) + '</pre></div>';
            }
          } catch (error) {
            responseDiv.innerHTML = '<div class="error">❌ Erreur réseau: ' + error.message + '</div>';
          }
        });

        // Charger preset market par défaut
        loadPreset('market');
      </script>
    </body>
    </html>
  `);
});

module.exports = router;