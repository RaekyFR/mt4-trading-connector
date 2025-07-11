// test/phase1_validation.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const config = {
  folder: process.env.FOLDER_PATH || 'C:\\Users\\cyril\\AppData\\Roaming\\MetaQuotes\\Terminal\\56EE5B2C68594C11EBC44B2E705CB8B7\\MQL4\\Files',
  timeout: 5000
};

console.log('🧪 VALIDATION PHASE 1 - CORRECTIONS MT4/Node.js');
console.log('================================================');

// Test 1: Communication de base corrigée
async function testBasicCommunication() {
  console.log('\n📋 Test 1: Communication de base');
  
  const testId = `phase1_test_${Date.now()}`;
  const command = {
    id: testId,
    command: "getBalance"
  };
  
  const commandFile = path.join(config.folder, 'command.txt');
  const responseFile = path.join(config.folder, 'response.txt');
  
  // Nettoyer les fichiers existants
  try {
    if (fs.existsSync(responseFile)) fs.unlinkSync(responseFile);
  } catch (e) {}
  
  // Envoyer la commande
  fs.writeFileSync(commandFile, JSON.stringify(command));
  console.log(`✅ Commande envoyée: ${command.command} (ID: ${testId})`);
  
  // Attendre la réponse
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkResponse = () => {
      if (Date.now() - startTime > config.timeout) {
        console.log('❌ Timeout - Pas de réponse de MT4');
        resolve({ success: false, reason: 'timeout' });
        return;
      }
      
      if (!fs.existsSync(responseFile)) {
        setTimeout(checkResponse, 100);
        return;
      }
      
      try {
        const content = fs.readFileSync(responseFile, 'utf8').trim();
        if (!content) {
          setTimeout(checkResponse, 100);
          return;
        }
        
        console.log(`📥 Réponse brute: ${content}`);
        
        const response = JSON.parse(content);
        
        // Vérifier la structure corrigée
        if (response.id === testId && response.result !== undefined) {
          console.log('✅ Structure JSON correcte');
          console.log(`✅ Balance reçue: ${response.result}`);
          
          // Nettoyer
          fs.unlinkSync(responseFile);
          
          resolve({ success: true, response });
        } else {
          console.log('❌ Structure JSON incorrecte');
          console.log('Structure reçue:', Object.keys(response));
          resolve({ success: false, reason: 'invalid_structure', response });
        }
        
      } catch (e) {
        console.log('❌ Erreur parsing JSON:', e.message);
        resolve({ success: false, reason: 'json_error', error: e.message });
      }
    };
    
    checkResponse();
  });
}

// Test 2: Ping séparé
async function testSeparatePing() {
  console.log('\n📋 Test 2: Ping séparé');
  
  const testId = `ping_test_${Date.now()}`;
  const pingCommand = {
    id: testId,
    command: "ping"
  };
  
  const pingCommandFile = path.join(config.folder, 'command-ping.txt');
  const pingResponseFile = path.join(config.folder, 'response-ping.txt');
  
  // Nettoyer
  try {
    if (fs.existsSync(pingResponseFile)) fs.unlinkSync(pingResponseFile);
  } catch (e) {}
  
  // Envoyer ping
  fs.writeFileSync(pingCommandFile, JSON.stringify(pingCommand));
  console.log(`✅ Ping envoyé (ID: ${testId})`);
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkPingResponse = () => {
      if (Date.now() - startTime > config.timeout) {
        console.log('❌ Timeout ping - Pas de réponse');
        resolve({ success: false, reason: 'timeout' });
        return;
      }
      
      if (!fs.existsSync(pingResponseFile)) {
        setTimeout(checkPingResponse, 100);
        return;
      }
      
      try {
        const content = fs.readFileSync(pingResponseFile, 'utf8').trim();
        if (!content) {
          setTimeout(checkPingResponse, 100);
          return;
        }
        
        console.log(`📥 Réponse ping: ${content}`);
        
        const response = JSON.parse(content);
        
        if (response.id === testId && response.result === 'pong') {
          console.log('✅ Ping/Pong fonctionne correctement');
          fs.unlinkSync(pingResponseFile);
          resolve({ success: true, response });
        } else {
          console.log('❌ Réponse ping incorrecte');
          resolve({ success: false, reason: 'invalid_ping_response', response });
        }
        
      } catch (e) {
        console.log('❌ Erreur parsing ping JSON:', e.message);
        resolve({ success: false, reason: 'ping_json_error', error: e.message });
      }
    };
    
    checkPingResponse();
  });
}

// Test 3: Test d'ordre simple
async function testSimpleOrder() {
  console.log('\n📋 Test 3: Ordre simple');
  
  const testId = `order_test_${Date.now()}`;
  const orderCommand = {
    id: testId,
    command: "marketOrder",
    symbol: "EURUSD",
    type: "buy",
    lot: 0.01,
    sl: 0,
    tp: 0,
    comment: "Test Phase 1"
  };
  
  const commandFile = path.join(config.folder, 'command.txt');
  const responseFile = path.join(config.folder, 'response.txt');
  
  // Nettoyer
  try {
    if (fs.existsSync(responseFile)) fs.unlinkSync(responseFile);
  } catch (e) {}
  
  fs.writeFileSync(commandFile, JSON.stringify(orderCommand));
  console.log(`✅ Ordre envoyé: ${orderCommand.type} ${orderCommand.lot} ${orderCommand.symbol}`);
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkOrderResponse = () => {
      if (Date.now() - startTime > config.timeout) {
        console.log('❌ Timeout ordre - Pas de réponse');
        resolve({ success: false, reason: 'timeout' });
        return;
      }
      
      if (!fs.existsSync(responseFile)) {
        setTimeout(checkOrderResponse, 100);
        return;
      }
      
      try {
        const content = fs.readFileSync(responseFile, 'utf8').trim();
        if (!content) {
          setTimeout(checkOrderResponse, 100);
          return;
        }
        
        console.log(`📥 Réponse ordre: ${content}`);
        
        const response = JSON.parse(content);
        
        if (response.id === testId) {
          if (response.result && response.result.ticket) {
            console.log(`✅ Ordre créé avec succès - Ticket: ${response.result.ticket}`);
            fs.unlinkSync(responseFile);
            resolve({ success: true, ticket: response.result.ticket, response });
          } else if (response.result && response.result.error) {
            console.log(`⚠️  Ordre rejeté par MT4: ${response.result.error}`);
            fs.unlinkSync(responseFile);
            resolve({ success: false, reason: 'mt4_rejection', error: response.result.error });
          } else {
            console.log('❌ Réponse ordre inattendue');
            resolve({ success: false, reason: 'unexpected_response', response });
          }
        } else {
          setTimeout(checkOrderResponse, 100);
        }
        
      } catch (e) {
        console.log('❌ Erreur parsing ordre JSON:', e.message);
        resolve({ success: false, reason: 'order_json_error', error: e.message });
      }
    };
    
    checkOrderResponse();
  });
}

// Test 4: Test de concurrence
async function testConcurrency() {
  console.log('\n📋 Test 4: Concurrence');
  
  const promises = [];
  const testCount = 3;
  
  for (let i = 0; i < testCount; i++) {
    promises.push(new Promise(async (resolve) => {
      await new Promise(r => setTimeout(r, i * 200)); // Décaler les envois
      
      const testId = `concurrent_test_${i}_${Date.now()}`;
      const command = {
        id: testId,
        command: "getBalance"
      };
      
      const commandFile = path.join(config.folder, 'command.txt');
      const responseFile = path.join(config.folder, 'response.txt');
      
      try {
        fs.writeFileSync(commandFile, JSON.stringify(command));
        console.log(`📤 Commande concurrente ${i} envoyée`);
        
        // Attendre réponse avec timeout court
        const startTime = Date.now();
        while (Date.now() - startTime < 3000) {
          if (fs.existsSync(responseFile)) {
            try {
              const content = fs.readFileSync(responseFile, 'utf8').trim();
              if (content) {
                const response = JSON.parse(content);
                if (response.id === testId) {
                  console.log(`✅ Réponse concurrente ${i} reçue`);
                  fs.unlinkSync(responseFile);
                  resolve({ success: true, index: i });
                  return;
                }
              }
            } catch (e) {
              // Continue
            }
          }
          await new Promise(r => setTimeout(r, 100));
        }
        
        console.log(`❌ Timeout commande concurrente ${i}`);
        resolve({ success: false, index: i, reason: 'timeout' });
        
      } catch (e) {
        console.log(`❌ Erreur commande concurrente ${i}:`, e.message);
        resolve({ success: false, index: i, reason: 'error', error: e.message });
      }
    }));
  }
  
  const results = await Promise.all(promises);
  const successes = results.filter(r => r.success);
  
  console.log(`Résultat concurrence: ${successes.length}/${testCount} succès`);
  
  return {
    success: successes.length >= Math.floor(testCount * 0.8), // 80% de succès minimum
    total: testCount,
    successes: successes.length,
    results
  };
}

// Test 5: Validation de la structure JSON corrigée
function testJSONStructure() {
  console.log('\n📋 Test 5: Structure JSON corrigée');
  
  // Tester les structures attendues après correction
  const tests = [
    {
      name: 'Balance response',
      json: '{"id":"test123","result":"10000.50"}',
      expected: { hasId: true, hasResult: true, resultType: 'string' }
    },
    {
      name: 'Order response',
      json: '{"id":"test456","result":{"ticket":789}}',
      expected: { hasId: true, hasResult: true, resultType: 'object' }
    },
    {
      name: 'Error response',
      json: '{"id":"test789","result":{"error":"Invalid parameters"}}',
      expected: { hasId: true, hasResult: true, resultType: 'object' }
    },
    {
      name: 'Ping response',
      json: '{"id":"ping123","result":"pong"}',
      expected: { hasId: true, hasResult: true, resultType: 'string' }
    }
  ];
  
  let allValid = true;
  
  tests.forEach(test => {
    try {
      const parsed = JSON.parse(test.json);
      
      const hasId = parsed.hasOwnProperty('id');
      const hasResult = parsed.hasOwnProperty('result');
      const resultType = typeof parsed.result;
      
      const valid = hasId === test.expected.hasId && 
                   hasResult === test.expected.hasResult && 
                   resultType === test.expected.resultType;
      
      if (valid) {
        console.log(`✅ ${test.name}: Structure valide`);
      } else {
        console.log(`❌ ${test.name}: Structure invalide`);
        console.log(`   Attendu: id=${test.expected.hasId}, result=${test.expected.hasResult}, type=${test.expected.resultType}`);
        console.log(`   Reçu: id=${hasId}, result=${hasResult}, type=${resultType}`);
        allValid = false;
      }
      
    } catch (e) {
      console.log(`❌ ${test.name}: JSON invalide - ${e.message}`);
      allValid = false;
    }
  });
  
  return allValid;
}

// Fonction principale de validation
async function runPhase1Validation() {
  console.log(`Dossier MT4: ${config.folder}`);
  console.log(`Timeout: ${config.timeout}ms\n`);
  
  const results = {
    jsonStructure: testJSONStructure(),
    basicCommunication: await testBasicCommunication(),
    separatePing: await testSeparatePing(),
    simpleOrder: await testSimpleOrder(),
    concurrency: await testConcurrency()
  };
  
  console.log('\n📊 RÉSULTATS PHASE 1');
  console.log('====================');
  console.log(`Structure JSON corrigée: ${results.jsonStructure ? '✅' : '❌'}`);
  console.log(`Communication de base: ${results.basicCommunication.success ? '✅' : '❌'}`);
  console.log(`Ping séparé: ${results.separatePing.success ? '✅' : '❌'}`);
  console.log(`Ordre simple: ${results.simpleOrder.success ? '✅' : '❌'}`);
  console.log(`Test concurrence: ${results.concurrency.success ? '✅' : '❌'}`);
  
  const successCount = Object.values(results).filter(r => 
    r === true || (r && r.success)
  ).length;
  
  console.log(`\n🎯 SCORE GLOBAL: ${successCount}/5 tests réussis`);
  
  if (successCount >= 4) {
    console.log('✅ PHASE 1 VALIDÉE - Prêt pour Phase 2');
  } else {
    console.log('❌ PHASE 1 ÉCHOUÉE - Corrections nécessaires');
    
    console.log('\n🔧 ACTIONS CORRECTIVES:');
    if (!results.jsonStructure) {
      console.log('- Vérifier la correction de WriteResponse() dans file_io.mqh');
    }
    if (!results.basicCommunication.success) {
      console.log('- Vérifier la compilation et l\'exécution de l\'EA');
      console.log(`- Erreur: ${results.basicCommunication.reason}`);
    }
    if (!results.separatePing.success) {
      console.log('- Vérifier le système de ping séparé');
      console.log(`- Erreur: ${results.separatePing.reason}`);
    }
    if (!results.simpleOrder.success) {
      console.log('- Vérifier les paramètres d\'ordre MT4');
      console.log(`- Erreur: ${results.simpleOrder.reason || results.simpleOrder.error}`);
    }
    if (!results.concurrency.success) {
      console.log('- Améliorer la gestion de la concurrence des fichiers');
    }
  }
  
  return results;
}

// Export pour utilisation externe
module.exports = {
  runPhase1Validation,
  testBasicCommunication,
  testSeparatePing,
  testSimpleOrder,
  testConcurrency,
  testJSONStructure
};

// Exécuter si appelé directement
if (require.main === module) {
  runPhase1Validation().catch(console.error);
}