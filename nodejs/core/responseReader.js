const fs = require('fs');
const path = require('path');
const { folder } = require('../config');
const { clearWaitingFlag, isWaiting } = require('./commandHandler');

const responseFile = path.join(folder, 'response.txt');

function readResponse() {
  if (!isWaiting() || !fs.existsSync(responseFile)) return;

  const data = fs.readFileSync(responseFile, 'utf8').trim();
  if (data) {
    console.log(`[Node ✅] Réponse reçue : ${data}`);
    fs.unlinkSync(responseFile);
    clearWaitingFlag();
  }
}

module.exports = { readResponse };