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
  res.json(currentCommand);
});

// MT4 envoie la balance
app.post('/balance', (req, res) => {
  latestBalance = req.body.balance;
  currentCommand = { command: "" }; // Réinitialiser la commande
  res.sendStatus(200);
});

// Interface Web envoie une commande
app.post('/send-command', (req, res) => {
  currentCommand = { command: "getBalance" };
  latestBalance = null;
  res.json({ ok: true });
});

// Interface Web demande la dernière balance
app.get('/last-balance', (req, res) => {
  res.json({ balance: latestBalance });
});

app.listen(PORT, () => {
  console.log(`Serveur en ligne sur http://localhost:${PORT}`);
});
