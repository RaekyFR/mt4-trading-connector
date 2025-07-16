// nodejs/scripts/test-signal.js
// Script pour tester l'envoi d'un signal complet
require('dotenv').config();
const fetch = require('node-fetch'); // npm install node-fetch si nécessaire

async function testSignal() {
  const signal = {
    strategy: 'TestStrategy',
    action: 'buy',
    symbol: 'EURUSD',
    price: 1.0850,
    stopLoss: 1.0800,
    takeProfit: 1.0950,
    lot: 0.1,
    comment: 'Test signal from script'
  };

  console.log('📤 Envoi du signal:', signal);

  try {
    const response = await fetch('http://localhost:3000/webhook/tradingview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET || ''
      },
      body: JSON.stringify(signal)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Signal accepté:', result);
    } else {
      console.log('❌ Signal rejeté:', result);
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

testSignal();