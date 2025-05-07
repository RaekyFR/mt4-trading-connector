const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 8080;

app.use(bodyParser.json());

let currentCommand = { command: "getBalance" };
let latestBalance = null;

// Route GET appelée par MT4 pour interroger s'il y a une commande
app.get('/command', (req, res) => {
  console.log("MT4 a demandé une commande.");
  res.json(currentCommand);
});

// Route POST appelée par MT4 pour envoyer la balance
app.post('/balance', (req, res) => {
  latestBalance = req.body.balance;
  console.log("Balance reçue de MT4 :", latestBalance);

  // Réinitialiser la commande une fois traitée
  currentCommand = { command: "" };

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Serveur MT4 en écoute sur http://localhost:${PORT}`);
});
