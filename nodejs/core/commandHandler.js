const fs = require('fs');
const path = require('path');
const { folder } = require('../config');
const { v4: uuidv4 } = require('uuid'); // npm install uuid

const commandFile = path.join(folder, 'command.txt');

let currentCommand = null;

function sendCommand(commandName, timeout) {
  const now = Date.now();

  if (currentCommand && now - currentCommand.time < timeout) return false;

  if (currentCommand) {
    console.warn(`[Node ⚠️] Timeout de la commande ${currentCommand.id}`);
  }

  const id = `cmd-${uuidv4()}`;
  const command = {
    id,
    command: commandName
  };

  fs.writeFileSync(commandFile, JSON.stringify(command));
  currentCommand = { ...command, time: now };

  console.log(`[Node ⬆️] Commande envoyée : ${JSON.stringify(command)}`);
  return true;
}

function getCurrentCommand() {
  return currentCommand;
}

function clearCurrentCommand() {
  currentCommand = null;
}

module.exports = { sendCommand, getCurrentCommand, clearCurrentCommand };