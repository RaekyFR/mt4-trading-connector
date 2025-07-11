// test/communication_audit.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const folder = process.env.FOLDER_PATH || 'C:\\Users\\cyril\\AppData\\Roaming\\MetaQuotes\\Terminal\\56EE5B2C68594C11EBC44B2E705CB8B7\\MQL4\\Files';
const responseFile = path.join(folder, 'response.txt');

console.log('🔍 AUDIT DE COMMUNICATION MT4/Node.js');
console.log('=====================================');

// Test 1: Structure JSON actuelle
function testCurrentJSONStructure() {
  console.log('\n📋 Test 1: Structure JSON actuelle');
  
  // Simuler la réponse actuelle de MT4 (avec double encapsulation)
  const currentMT4Response = '{"id" : "test123" , "result" : {"ticket":456}}';
  
  try {
    const parsed = JSON.parse(currentMT4Response);
    console.log('✅ JSON parsable');
    console.log('Structure:', JSON.stringify(parsed, null, 2));
    
    // Vérifier si c'est la structure attendue
    if (parsed.id && parsed.result) {
      console.log('✅ Structure id/result présente');
      
      // Problème : si result est déjà un objet JSON, on a une double encapsulation
      if (typeof parsed.result === 'object') {
        console.log('⚠️  PROBLÈME: Double encapsulation détectée');
        console.log('   - MT4 envoie déjà un objet dans result');
        console.log('   - WriteResponse() rajoute une couche');
        return false;
      }
    }
    return true;
  } catch (e) {
    console.log('❌ JSON invalide:', e.message);
    return false;
  }
}

// Test 2: Vérifier les fichiers existants
function checkExistingFiles() {
  console.log('\n📋 Test 2: Vérification des fichiers');
  
  const filesToCheck = [
    'command.txt',
    'response.txt',
    'command-ping.txt',
    'response-ping.txt'
  ];
  
  const results = {};
  
  filesToCheck.forEach(filename => {
    const filepath = path.join(folder, filename);
    const exists = fs.existsSync(filepath);
    results[filename] = exists;
    
    if (exists) {
      const stats = fs.statSync(filepath);
      console.log(`✅ ${filename} existe (${stats.size} bytes, modifié: ${stats.mtime.toLocaleString()})`);
      
      // Lire le contenu si petit
      if (stats.size < 1000 && stats.size > 0) {
        try {
          const content = fs.readFileSync(filepath, 'utf8');
          console.log(`   Contenu: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
        } catch (e) {
          console.log(`   ❌ Erreur lecture: ${e.message}`);
        }
      }
    } else {
      console.log(`❌ ${filename} n'existe pas`);
    }
  });
  
  return results;
}

// Test 3: Tester l'écriture/lecture
function testFileOperations() {
  console.log('\n📋 Test 3: Opérations sur fichiers');
  
  const testFile = path.join(folder, 'test_communication.txt');
  const testData = {
    id: 'audit_test',
    command: 'ping',
    timestamp: new Date().toISOString()
  };
  
  try {
    // Test écriture
    fs.writeFileSync(testFile, JSON.stringify(testData));
    console.log('✅ Écriture fichier OK');
    
    // Test lecture
    const readData = fs.readFileSync(testFile, 'utf8');
    const parsed = JSON.parse(readData);
    console.log('✅ Lecture fichier OK');
    
    // Test suppression
    fs.unlinkSync(testFile);
    console.log('✅ Suppression fichier OK');
    
    return true;
  } catch (e) {
    console.log('❌ Erreur opération fichier:', e.message);
    return false;
  }
}

// Test 4: Simulation problème de concurrence
function testConcurrencyIssues() {
  console.log('\n📋 Test 4: Simulation problèmes de concurrence');
  
  const testFile = path.join(folder, 'concurrency_test.txt');
  
  // Simuler écritures simultanées
  const promises = [];
  
  for (let i = 0; i < 5; i++) {
    promises.push(new Promise((resolve) => {
      setTimeout(() => {
        try {
          fs.writeFileSync(testFile, `Test ${i} - ${Date.now()}`);
          resolve({ success: true, id: i });
        } catch (e) {
          resolve({ success: false, id: i, error: e.message });
        }
      }, Math.random() * 100);
    }));
  }
  
  return Promise.all(promises).then(results => {
    const failures = results.filter(r => !r.success);
    console.log(`Concurrent writes: ${failures.length}/5 échecs`);
    
    if (failures.length > 0) {
      console.log('❌ Problèmes de concurrence détectés');
      failures.forEach(f => console.log(`   ID ${f.id}: ${f.error}`));
    } else {
      console.log('✅ Pas de problème de concurrence apparent');
    }
    
    // Nettoyer
    try {
      fs.unlinkSync(testFile);
    } catch (e) {
      // Ignore
    }
    
    return failures.length === 0;
  });
}

// Test 5: Analyser les réponses de tests existants
function analyzeExistingTestResponses() {
  console.log('\n📋 Test 5: Analyse des réponses de tests existants');
  
  // Chercher les fichiers de log récents
  const logPatterns = [
    'response*.txt',
    'command*.txt'
  ];
  
  try {
    const files = fs.readdirSync(folder);
    const relevantFiles = files.filter(f => 
      f.includes('response') || f.includes('command')
    );
    
    console.log(`Fichiers trouvés: ${relevantFiles.join(', ')}`);
    
    relevantFiles.forEach(filename => {
      const filepath = path.join(folder, filename);
      try {
        const content = fs.readFileSync(filepath, 'utf8');
        if (content.trim()) {
          console.log(`\n📄 ${filename}:`);
          console.log(content.substring(0, 200));
          
          // Tenter de parser comme JSON
          try {
            const parsed = JSON.parse(content);
            console.log('   ✅ JSON valide');
            
            // Analyser la structure
            if (parsed.id && parsed.result) {
              console.log('   ✅ Structure attendue (id/result)');
            } else {
              console.log('   ⚠️  Structure inattendue');
              console.log('   Clés trouvées:', Object.keys(parsed));
            }
          } catch (e) {
            console.log('   ❌ JSON invalide:', e.message);
          }
        }
      } catch (e) {
        console.log(`   ❌ Erreur lecture ${filename}: ${e.message}`);
      }
    });
    
  } catch (e) {
    console.log('❌ Erreur liste fichiers:', e.message);
  }
}

// Exécution de l'audit
async function runAudit() {
  console.log(`Dossier MT4: ${folder}`);
  console.log(`Existence dossier: ${fs.existsSync(folder) ? '✅' : '❌'}`);
  
  const results = {
    jsonStructure: testCurrentJSONStructure(),
    fileCheck: checkExistingFiles(),
    fileOperations: testFileOperations(),
    concurrency: await testConcurrencyIssues()
  };
  
  analyzeExistingTestResponses();
  
  console.log('\n📊 RÉSUMÉ DE L\'AUDIT');
  console.log('===================');
  console.log(`Structure JSON: ${results.jsonStructure ? '✅' : '❌'}`);
  console.log(`Opérations fichiers: ${results.fileOperations ? '✅' : '❌'}`);
  console.log(`Concurrence: ${results.concurrency ? '✅' : '❌'}`);
  
  console.log('\n🎯 PROBLÈMES IDENTIFIÉS:');
  if (!results.jsonStructure) {
    console.log('❌ Double encapsulation JSON dans WriteResponse()');
  }
  if (!results.concurrency) {
    console.log('❌ Problèmes potentiels de concurrence sur les fichiers');
  }
  
  console.log('\n📋 ACTIONS RECOMMANDÉES:');
  console.log('1. Corriger WriteResponse() dans file_io.mqh');
  console.log('2. Supprimer json_parser_number.mqh (doublon)');
  console.log('3. Corriger les chemins d\'inclusion dans command_handler.mqh');
  console.log('4. Ajouter système de verrous pour les fichiers');
  
  return results;
}

// Exporter pour utilisation dans d'autres tests
module.exports = {
  runAudit,
  testCurrentJSONStructure,
  checkExistingFiles,
  testFileOperations,
  testConcurrencyIssues
};

// Exécuter si appelé directement
if (require.main === module) {
  runAudit().catch(console.error);
}