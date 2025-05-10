#property strict

input string serverIp = "127.0.0.1"; //ip serveur node
input int serverPort = 8080;

int socket;

// Timer = requête toutes les secondes
int OnInit() {
   EventSetTimer(1);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
   EventKillTimer();
}

void OnTimer() {
   socket = SocketCreate();
   if (socket == INVALID_HANDLE) {
      Print("Erreur création socket");
      return;
   }

   if (!SocketConnect(socket, serverIp, serverPort)) {
      Print("Erreur connexion socket");
      SocketClose(socket);
      return;
   }

   string request = 
      "GET /command HTTP/1.1\r\n"
      "Host: " + serverIp + "\r\n"
      "Connection: close\r\n\r\n";

   int sent = SocketSend(socket, request);
   if (sent != StringLen(request)) {
      Print("Erreur envoi requête");
      SocketClose(socket);
      return;
   }

   string response = "";
   char buffer[512];
   int bytes;

   while ((bytes = SocketRead(socket, buffer, sizeof(buffer))) > 0) {
      response += CharArrayToString(buffer, 0, bytes);
   }

   SocketClose(socket);

   // ✅ Traitement de la réponse brute
   if (StringFind(response, "getBalance") >= 0) {
      Print("Commande reçue : getBalance");
      // Tu pourrais ici appeler ta fonction de POST manuelle pour renvoyer la balance
   } else {
      Print("Réponse serveur : ", response);
   }
}
