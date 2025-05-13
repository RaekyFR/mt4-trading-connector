const fs = require('fs');
const path = require('path');
const { folder } = require('../config');

const commandFile = path.join(folder, 'command.txt');

let waitingForResponse = false;
let lastCommandTime = 0;

function sendCommand(command, timeout) {
  const now = Date.now();

  if (waitingForResponse && now - lastCommandTime < timeout) return false;

  if (waitingForResponse) {
    console.warn(`[Node ⚠️] Timeout sans réponse, nouvelle commande forcée`);
  }

  fs.writeFileSync(commandFile, command);
  lastCommandTime = now;
  waitingForResponse = true;

  console.log(`[Node ⬆️] Commande envoyée : ${command}`);
  return true;
}

function clearWaitingFlag() {
  waitingForResponse = false;
}

function isWaiting() {
  return waitingForResponse;
}

module.exports = { sendCommand, isWaiting, clearWaitingFlag };
