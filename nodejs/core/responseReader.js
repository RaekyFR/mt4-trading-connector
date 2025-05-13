const fs = require('fs');
const path = require('path');
const { folder } = require('../config');
const { getCurrentCommand, clearCurrentCommand } = require('./commandHandler');

const responseFile = path.join(folder, 'response.txt');

function readResponse() {
  if (!fs.existsSync(responseFile)) return;

  const raw = fs.readFileSync(responseFile, 'utf8').trim();
  if (!raw) return;

  try {
    const response = JSON.parse(raw);
    const current = getCurrentCommand();

    if (!current || response.id !== current.id) {
      console.warn(`[Node ❗] Réponse ignorée : ID ${response.id} inattendu`);
      return;
    }

    console.log(`[Node ✅] Réponse reçue pour ${response.id} :`, response.result);
    clearCurrentCommand();
    fs.unlinkSync(responseFile);

  } catch (e) {
    console.error('[Node ❌] Erreur parsing réponse JSON:', e.message);
  }
}

module.exports = { readResponse };
