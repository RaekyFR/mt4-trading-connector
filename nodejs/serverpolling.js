const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 8080;

app.use(bodyParser.json());
app.use(express.static('public'));

let currentCommand = { command: "" };
let latestBalance = null;

// MT4 demande une commande
app.get('/command', (req, res) => {
  console.log('[MT4] ➤ Requête de commande reçue. Commande actuelle :', currentCommand.command);
  res.json(currentCommand);
});

// MT4 envoie la balance
app.post('/balance', (req, res) => {
  latestBalance = req.body.balance;
  console.log('[MT4] ✅ Balance reçue :', latestBalance);
  currentCommand = { command: "" }; // Réinitialiser la commande
  res.sendStatus(200);
});

// Interface Web envoie une commande
app.post('/send-command', (req, res) => {
  currentCommand = { command: "getBalance" };
  latestBalance = null;
  console.log('[WEB] 🟢 Commande "getBalance" envoyée à MT4');
  res.json({ ok: true });
});

// Interface Web demande la dernière balance
app.get('/last-balance', (req, res) => {
  console.log('[WEB] 🔍 Requête de lecture de la balance. Valeur actuelle :', latestBalance);
  res.json({ balance: latestBalance });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur Node.js en ligne sur http://localhost:${PORT}`);
});
