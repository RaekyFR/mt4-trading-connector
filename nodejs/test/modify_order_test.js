require('dotenv').config();
const fs = require('fs');
const path = require('path');

const folder = process.env.FOLDER_PATH;
const commandFile = path.join(folder, process.env.COMMAND_FILE || 'command.txt');
const responseFile = path.join(folder, process.env.RESPONSE_FILE || 'response.txt');

const orderId = `modify-order-${Date.now()}`;
const ticketNumber = 77611176; // Remplace par un ticket réel

function sendCommand() {
  const command = {
    id: orderId,
    command: "modifyOrder",
    ticket: ticketNumber,
    sl: 106500,     // Exemple : nouvelle valeur SL
    tp: 102000,     // Exemple : nouvelle valeur TP
    // price: 1.0950, // Exemple : nouvelle valeur pour pending
    // expiration: Date.now() / 1000 + 3600, // Timestamp en secondes
    comment: "modification depuis Node"
  };

  fs.writeFileSync(commandFile, JSON.stringify(command), 'utf8');
  console.log(`[Node ⬆️] Commande envoyée : modifyOrder`);
}

function readResponse() {
  if (!fs.existsSync(responseFile)) return;

  const content = fs.readFileSync(responseFile, 'utf8');
  try {
    const json = JSON.parse(content);

    if (json.id === orderId) {
      console.log(`[Node ✅] Réponse reçue :`, JSON.stringify(json, null, 2));
      clearInterval(responsePoller);
      fs.unlinkSync(responseFile);
    } else {
      console.warn(`[Node ⚠️] Réponse ignorée (ID inattendu)`);
    }
  } catch (err) {
    console.error("[Node ❌] Erreur JSON :", err.message);
  }
}

sendCommand();
const responsePoller = setInterval(readResponse, 1000);
