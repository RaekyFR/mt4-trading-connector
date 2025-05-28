require("dotenv").config();
const fs = require("fs");
const path = require("path");

const folder = process.env.FOLDER_PATH;
const commandFile = path.join(
  folder,
  process.env.COMMAND_FILE || "command.txt"
);
const responseFile = path.join(
  folder,
  process.env.RESPONSE_FILE || "response.txt"
);

const orderId = `close-all-pending-${Date.now()}`;

function sendCommand() {
  const command = {
    id: orderId,
    command: "closeAllPendingOrders",
  };

  fs.writeFileSync(commandFile, JSON.stringify(command), "utf8");
  console.log(`[Node ⬆️] Commande envoyée : closeAllPendingOrders`);
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
