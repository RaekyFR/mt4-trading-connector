#property strict

input string serverIp = "127.0.0.1";  // Adresse du serveur local (localhost)
input int serverPort = 8080;           // Port de ton serveur

// Fonction d'initialisation de l'EA
int OnInit() {
   EventSetTimer(1);  // Définir un timer qui appelle OnTimer toutes les secondes
   return INIT_SUCCEEDED;
}

// Fonction de désinitialisation de l'EA
void OnDeinit(const int reason) {
   EventKillTimer();  // Arrêter le timer
}

// Fonction appelée à chaque intervalle de temps (chaque seconde)
void OnTimer() {
   string url = "http://" + serverIp + ":" + IntegerToString(serverPort) + "/command";
   string response = HttpGet(url);
   
   if (response == "") {
      Print("Aucune réponse du serveur.");
      return;
   }

   Print("Réponse reçue : ", response);

   // Vérifier si la réponse contient la commande 'getBalance'
   if (StringFind(response, "getBalance") >= 0) {
      double balance = AccountBalance();  // Récupérer la balance du compte
      string payload = "{\"balance\":" + DoubleToString(balance, 2) + "}";
      HttpPost("http://" + serverIp + ":" + IntegerToString(serverPort) + "/balance", payload);
      Print("Balance envoyée : ", payload);
   }
}

// Fonction pour effectuer une requête GET
string HttpGet(string url) {
   string headers = "Content-Type: application/json\r\n";
   char result[];
   string resultHeaders;
   char postData[];  // Pas de données à envoyer pour GET

   // Effectuer la requête GET
   int res = WebRequest("GET", url, headers, 5000, postData, result, resultHeaders);

   // Si WebRequest a réussi, renvoyer la réponse, sinon une chaîne vide
   if (res == -1) {
      Print("Erreur WebRequest GET : ", GetLastError());
      return "";
   }

   // Convertir le tableau result[] en string pour afficher la réponse
   string response = CharArrayToString(result);
   return response;
}

// Fonction pour effectuer une requête POST
void HttpPost(string url, string payload) {
   string headers = "Content-Type: application/json\r\n";
   char result[];
   string resultHeaders;
   char postData[];

   // Convertir la chaîne payload en format char[]
   StringToCharArray(payload, postData);

   // Effectuer la requête POST
   int res = WebRequest("POST", url, headers, 5000, postData, result, resultHeaders);

   // Vérifier le résultat de la requête POST
   if (res == -1) {
      Print("Erreur WebRequest POST : ", GetLastError());
   } else {
      // Convertir le tableau result[] en string pour afficher la réponse
      string response = CharArrayToString(result);
      Print("Réponse après POST : ", response);
   }
}
