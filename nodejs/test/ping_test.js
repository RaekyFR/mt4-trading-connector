require('dotenv').config();
const fs = require('fs');
const path = require('path');

const folder = process.env.FOLDER_PATH;
const commandFile = path.join(folder, 'command-ping.txt');
const responseFile = path.join(folder, 'response-ping.txt');

const orderId = `ping-${Date.now()}`;

function sendCommand() {
  const command = {
    id: orderId,
    command: "ping"
  };

  fs.writeFileSync(commandFile, JSON.stringify(command), 'utf8');
  console.log(`[Node ⬆️] Ping envoyé`);
}

function readResponse() {
  if (!fs.existsSync(responseFile)) return;

  const content = fs.readFileSync(responseFile, 'utf8');
  try {
    const json = JSON.parse(content);
    if (json.id === orderId) {
      console.log(`[Node ✅] Pong reçu :`, JSON.stringify(json, null, 2));
      clearInterval(responsePoller);
      fs.unlinkSync(responseFile);
    }
  } catch (err) {
    console.error("[Node ❌] Erreur JSON :", err.message);
  }

  if (fs.existsSync(responseFile)) {
  const size = fs.statSync(responseFile).size;
  console.log("📁 Fichier trouvé, taille :", size);

  if (size === 0) {
    console.warn("⚠️ Le fichier est vide. Attente ou bug MT4 ?");
    return;
  }

  const content = fs.readFileSync(responseFile, 'utf8');
  console.log("📄 Contenu brut :", content);
}
}

sendCommand();
const responsePoller = setInterval(readResponse, 1000);
