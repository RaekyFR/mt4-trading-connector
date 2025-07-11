// test/quick_test.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const folder = process.env.FOLDER_PATH || 'C:\\Users\\cyril\\AppData\\Roaming\\MetaQuotes\\Terminal\\56EE5B2C68594C11EBC44B2E705CB8B7\\MQL4\\Files';

console.log('🚀 TEST RAPIDE DE COMMUNICATION');
console.log('================================');
console.log(`Dossier MT4: ${folder}`);

async function quickTest() {
  const testId = `quick_test_${Date.now()}`;
  const command = {
    id: testId,
    command: "getBalance"
  };
  
  const commandFile = path.join(folder, 'command.txt');
  const responseFile = path.join(folder, 'response.txt');
  
  // Nettoyer les fichiers existants
  try {
    if (fs.existsSync(responseFile)) {
      fs.unlinkSync(responseFile);
      console.log('🧹 Fichier réponse nettoyé');
    }
  } catch (e) {
    console.log('⚠️  Impossible de nettoyer:', e.message);
  }
  
  // Envoyer la commande
  console.log(`📤 Envoi commande: ${command.command} (ID: ${testId})`);
  fs.writeFileSync(commandFile, JSON.stringify(command));
  
  // Attendre la réponse
  return new Promise((resolve) => {
    const startTime = Date.now();
    const timeout = 5000; // 5 secondes
    
    const checkResponse = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed > timeout) {
        console.log('❌ TIMEOUT - Pas de réponse après 5 secondes');
        console.log('');
        console.log('🔍 DIAGNOSTIC:');
        console.log('1. L\'EA est-il actif? (smiley souriant dans MT4)');
        console.log('2. Y a-t-il des erreurs dans l\'onglet Experts?');
        console.log('3. Le trading automatique est-il autorisé?');
        resolve(false);
        return;
      }
      
      if (!fs.existsSync(responseFile)) {
        console.log(`⏳ Attente réponse... (${Math.floor(elapsed/1000)}s)`);
        setTimeout(checkResponse, 500);
        return;
      }
      
      try {
        const content = fs.readFileSync(responseFile, 'utf8').trim();
        if (!content) {
          console.log('📄 Fichier réponse vide, attente...');
          setTimeout(checkResponse, 200);
          return;
        }
        
        console.log('📥 RÉPONSE REÇUE:');
        console.log(content);
        console.log('');
        
        const response = JSON.parse(content);
        
        if (response.id === testId) {
          console.log('✅ ID correspondant');
          console.log('✅ Structure JSON valide');
          
          if (response.result !== undefined) {
            console.log(`✅ Balance reçue: ${response.result}`);
            console.log('');
            console.log('🎉 COMMUNICATION FONCTIONNE PARFAITEMENT!');
            
            // Nettoyer
            fs.unlinkSync(responseFile);
            resolve(true);
          } else {
            console.log('❌ Pas de résultat dans la réponse');
            resolve(false);
          }
        } else {
          console.log(`❌ ID incorrect. Attendu: ${testId}, Reçu: ${response.id}`);
          resolve(false);
        }
        
      } catch (e) {
        console.log('❌ Erreur parsing JSON:', e.message);
        console.log('Contenu brut:', content);
        resolve(false);
      }
    };
    
    checkResponse();
  });
}

// Test du ping séparé
async function quickPingTest() {
  console.log('\n📡 TEST PING SÉPARÉ');
  console.log('==================');
  
  const testId = `ping_test_${Date.now()}`;
  const command = {
    id: testId,
    command: "ping"
  };
  
  const commandFile = path.join(folder, 'command-ping.txt');
  const responseFile = path.join(folder, 'response-ping.txt');
  
  // Nettoyer
  try {
    if (fs.existsSync(responseFile)) {
      fs.unlinkSync(responseFile);
    }
  } catch (e) {}
  
  console.log(`📤 Envoi ping (ID: ${testId})`);
  fs.writeFileSync(commandFile, JSON.stringify(command));
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    const timeout = 15000; // 15 secondes pour le ping (cycle de 10s)
    
    const checkPing = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed > timeout) {
        console.log('❌ TIMEOUT PING - Pas de réponse après 15 secondes');
        console.log('💡 Le ping est traité toutes les 10 secondes, c\'est normal');
        resolve(false);
        return;
      }
      
      if (!fs.existsSync(responseFile)) {
        if (elapsed % 2000 < 200) { // Afficher toutes les 2 secondes
          console.log(`⏳ Attente ping... (${Math.floor(elapsed/1000)}s) - Traité toutes les 10s`);
        }
        setTimeout(checkPing, 200);
        return;
      }
      
      try {
        const content = fs.readFileSync(responseFile, 'utf8').trim();
        if (!content) {
          setTimeout(checkPing, 200);
          return;
        }
        
        console.log('📥 RÉPONSE PING:');
        console.log(content);
        
        const response = JSON.parse(content);
        
        if (response.id === testId && response.result === 'pong') {
          console.log('✅ PING/PONG FONCTIONNE!');
          fs.unlinkSync(responseFile);
          resolve(true);
        } else {
          console.log('❌ Réponse ping incorrecte');
          resolve(false);
        }
        
      } catch (e) {
        console.log('❌ Erreur parsing ping:', e.message);
        resolve(false);
      }
    };
    
    checkPing();
  });
}

// Exécution
async function runQuickTests() {
  console.log('🎯 PRÉREQUIS:');
  console.log('- EA ea_server_debug actif sur un graphique MT4');
  console.log('- Trading automatique autorisé (bouton Expert Advisors)');
  console.log('- Connexion au serveur MT4 active');
  console.log('');
  
  const balanceOK = await quickTest();
  
  if (balanceOK) {
    console.log('\n➡️  Test ping dans 2 secondes...');
    await new Promise(r => setTimeout(r, 2000));
    
    const pingOK = await quickPingTest();
    
    if (pingOK) {
      console.log('\n🎉 TOUS LES TESTS PASSENT!');
      console.log('✅ Phase 1 validée - Communication fonctionnelle');
      console.log('➡️  Vous pouvez maintenant passer à la Phase 2');
    } else {
      console.log('\n⚠️  Balance OK mais ping KO');
      console.log('💡 Ping traité toutes les 10 secondes, réessayez');
    }
  } else {
    console.log('\n❌ Test de base échoué');
    console.log('🔧 Vérifiez la configuration MT4');
  }
}

runQuickTests().catch(console.error);