const fs = require('fs');
const path = require('path');

// 🔧 Met ici le chemin vers ton dossier MQL4/Files
const folder = 'C:\\Users\\cyril\\AppData\\Roaming\\MetaQuotes\\Terminal\\56EE5B2C68594C11EBC44B2E705CB8B7\\MQL4\\Files';
const commandFile = path.join(folder, 'command.txt');
const responseFile = path.join(folder, 'response.txt');

const orderId = `close-all-${Date.now()}`;

function sendCommand() {
  const command = {
    id: orderId,
    command: "closeAllMarketOrders"
  };

  fs.writeFileSync(commandFile, JSON.stringify(command), 'utf8');
  console.log(`[Node ⬆️] Commande envoyée : closeAllMarketOrders`);
}

function readResponse() {
  if (!fs.existsSync(responseFile)) return;

  const content = fs.readFileSync(responseFile, 'utf8');
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
sendCommand();
const responsePoller = setInterval(readResponse, 1000);
