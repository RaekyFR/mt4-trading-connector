require("dotenv").config();
const fs = require("fs");
const path = require("path");

// 🔧 À adapter : chemin vers le dossier Files de MT4
const folder = process.env.FOLDER_PATH;
const commandFile = path.join(folder, "command.txt");
const responseFile = path.join(folder, "response.txt");

const orderId = `test-${Date.now()}`;

// 📤 Écrire une commande d’ordre au marché
function sendMarketOrder() {
  const command = {
    id: orderId,
    command: "marketOrder",
    symbol: "BTCUSD",
    type: "buy", // ou "sell"
    lot: 0.01,
    sl: 106000,
    tp: 120000,
    comment: "test depuis Node.js",
  };

  fs.writeFileSync(commandFile, JSON.stringify(command), "utf8");
  console.log(
    `[Node ⬆️] Commande envoyée : ${command.command} (${command.symbol})`
  );
}

// 📥 Lire la réponse de MT4
function readResponse() {
  if (!fs.existsSync(responseFile)) return;

  const content = fs.readFileSync(responseFile, "utf8");
  try {
    const json = JSON.parse(content);

    if (json.id === orderId) {
      console.log(`[Node ✅] Réponse reçue :`, json);
      clearInterval(responsePoller); // Stopper après succès
      fs.unlinkSync(responseFile); // Nettoyer
    } else {
      console.warn(`[Node ⚠️] Réponse ignorée (ID inattendu)`);
    }
  } catch (err) {
    console.error("[Node ❌] Erreur parsing JSON :", err.message);
  }
}

// ▶️ Lancer le test
sendMarketOrder();
const responsePoller = setInterval(readResponse, 1000);
