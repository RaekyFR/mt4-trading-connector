require("dotenv").config();
const fs = require("fs");
const path = require("path");

// 🔧 À adapter avec ton chemin MQL4/Files
const folder = process.env.FOLDER_PATH;
const commandFile = path.join(folder, "command.txt");
const responseFile = path.join(folder, "response.txt");

const orderId = `limit-${Date.now()}`;

// 📤 Envoie une commande LIMIT
function sendLimitOrder() {
  const command = {
    id: orderId,
    command: "limitOrder",
    symbol: "BTCUSD",
    type: "buy limit", // ou "sell limit"
    lot: 0.01,
    price: 109000, // à adapter au marché
    sl: 105000,
    tp: 120000,
    comment: "test limit depuis Node",
  };

  fs.writeFileSync(commandFile, JSON.stringify(command), "utf8");
  console.log(
    `[Node ⬆️] Commande envoyée : ${command.command} (${command.type})`
  );
}

// 📥 Lecture de la réponse
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

// ▶️ Exécution du test
sendLimitOrder();
const responsePoller = setInterval(readResponse, 1000);
