require("dotenv").config();
const fs = require("fs");
const path = require("path");

// 🔧 Chemin MQL4/Files
const folder = process.env.FOLDER_PATH;
const commandFile = path.join(folder, "command.txt");
const responseFile = path.join(folder, "response.txt");

const orderId = `close-one-${Date.now()}`;
const ticketNumber = 77604815; // 🔧 Remplace par un ticket réel à fermer

function sendCommand() {
  const command = {
    id: orderId,
    command: "closeMarketOrder",
    ticket: ticketNumber,
  };

  fs.writeFileSync(commandFile, JSON.stringify(command), "utf8");
  console.log(
    `[Node ⬆️] Commande envoyée : closeMarketOrder (${ticketNumber})`
  );
}

function readResponse() {
  if (!fs.existsSync(responseFile)) return;

  const content = fs.readFileSync(responseFile, "utf8");
  try {
    const json = JSON.parse(content);

    if (json.id === orderId) {
      console.log(`[Node ✅] Réponse reçue :`, json);
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
