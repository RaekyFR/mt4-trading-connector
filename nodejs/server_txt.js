const fs = require('fs');
const path = require('path');

const folder = 'C:\\Users\\cyril\\AppData\\Roaming\\MetaQuotes\\Terminal\\56EE5B2C68594C11EBC44B2E705CB8B7\\MQL4\\Files'; // mettre ici le bon chemin vers MQL4/Files si nécessaire
const commandFile = path.join(folder, 'command.txt');
const responseFile = path.join(folder, 'response.txt');

let waitingForResponse = false;
let lastCommandTime = 0;
const commandTimeout = 4000; // 4 secondes max pour recevoir une réponse

function sendCommand(command) {
  if (waitingForResponse) {
    const now = Date.now();
    if (now - lastCommandTime > commandTimeout) {
      console.warn(`[Node ⚠️ ] Timeout - pas de réponse reçue pour la commande précédente`);
      waitingForResponse = false;
    } else {
      return; // en attente, ne pas renvoyer encore
    }
  }

  fs.writeFileSync(commandFile, command);
  lastCommandTime = Date.now();
  waitingForResponse = true;
  console.log(`[Node ⬆️ ] Commande envoyée : ${command}`);
}

function readResponse() {
  if (!waitingForResponse || !fs.existsSync(responseFile)) return;

  const data = fs.readFileSync(responseFile, 'utf8').trim();
  if (data) {
    console.log(`[Node ✅ ] Réponse reçue : ${data}`);
    fs.unlinkSync(responseFile);
    waitingForResponse = false;
  }
}

// Envoie la commande toutes les 5 secondes, lit la réponse chaque seconde
setInterval(() => {
    sendCommand('getBalance');
  }, 5000); 

setInterval(readResponse, 1000);
