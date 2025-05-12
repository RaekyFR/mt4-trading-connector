const fs = require('fs');
const path = require('path');

const folder = 'C:\\Users\\cyril\\AppData\\Roaming\\MetaQuotes\\Terminal\\56EE5B2C68594C11EBC44B2E705CB8B7\\MQL4\\Files'; // mettre ici le bon chemin vers MQL4/Files si nécessaire
const commandFile = path.join(folder, 'command.txt');
const responseFile = path.join(folder, 'response.txt');

function sendCommand(command) {
  fs.writeFileSync(commandFile, command);
  console.log(`[Node] Commande envoyée : ${command}`);
}

function readResponse() {
  if (!fs.existsSync(responseFile)) return;
  const data = fs.readFileSync(responseFile, 'utf8').trim();
  if (data) {
    console.log(`[Node] Réponse reçue : ${data}`);
    // Optionnel : supprimer la réponse une fois lue
    fs.unlinkSync(responseFile);
  }
}

// Envoie la commande toutes les 5 secondes, lit la réponse chaque seconde
setInterval(() => {
    sendCommand('getBalance');
  }, 5000); 

setInterval(readResponse, 1000);
