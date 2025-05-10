const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// Utilisation de body-parser pour analyser les données JSON envoyées dans les requêtes POST
app.use(bodyParser.json());

// Route GET pour recevoir la commande de MT4
app.get('/command', (req, res) => {
    console.log('Requête reçue de MT4: ', req.method, req.url);

    // Simule une commande (ici "getBalance") envoyée à MT4
    const response = {
        command: "getBalance"
    };

    // Répondre avec la commande demandée
    res.json(response);
});

// Route POST pour recevoir la balance du compte
app.post('/balance', (req, res) => {
    console.log('Requête POST reçue de MT4: ', req.method, req.url);
    console.log('Données reçues (balance): ', req.body);

    // Assurer que le corps de la requête contient la balance
    if (req.body.balance) {
        console.log('Balance reçue : ', req.body.balance);
    } else {
        console.log('Aucune balance envoyée');
    }

    // Répondre à MT4 (indiquant que la balance a été reçue)
    const response = {
        message: 'Balance reçue et traitée',
        balance: req.body.balance
    };

    res.json(response);
});

// Démarrer le serveur sur le port 8080
const port = 8080;
app.listen(port, () => {
    console.log(`Serveur Node.js en cours d'exécution sur http://127.0.0.1:${port}`);
});
