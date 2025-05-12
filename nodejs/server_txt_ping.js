const fs = require('fs');
const path = require('path');

const folder = 'C:\\Users\\cyril\\AppData\\Roaming\\MetaQuotes\\Terminal\\56EE5B2C68594C11EBC44B2E705CB8B7\\MQL4\\Files';
const pingFile = path.join(folder, 'ping.txt');
const lockFile = path.join(folder, 'ping.lock');

function readPing() {
  if (fs.existsSync(lockFile)) {
    console.log('[Node] Fichier verrouillé, on attend...');
    return;
  }

  if (!fs.existsSync(pingFile)) {
    console.log('[Node] Aucun ping trouvé.');
    return;
  }

  try {
    const data = fs.readFileSync(pingFile, 'utf8').trim();
    if (data) {
      console.log(`[Node] Ping reçu : "${data}"`);
    } else {
      console.log('[Node] Fichier ping vide.');
    }
  } catch (err) {
    console.error('[Node] Erreur de lecture :', err.message);
  }


}

// Vérifie le ping toutes les secondes
setInterval(readPing, 1000);
