#property strict

#include <mq4-http.mqh>
#include <json.mqh>

extern string hostIp = "192.168.1.100"; // IP de ton Raspberry Pi
extern int hostPort = 8080;

MqlNet INet;

int init() {
   EventSetTimer(1); // appel OnTimer toutes les secondes
   return 0;
}

int deinit() {
   EventKillTimer();
   return 0;
}

void OnTimer() {
   string response = "";

   if (!INet.Open(hostIp, hostPort)) {
      Print("Erreur de connexion au serveur");
      return;
   }

   if (!INet.Request("GET", "/command", response, false, true, "", false)) {
      Print("Erreur lors de la requête GET");
      return;
   }

   if (response == "" || StringFind(response, "{") < 0) return;

   JSONParser *parser = new JSONParser();
   JSONValue *jv = parser.parse(response);

   if (jv == NULL) {
      Print("Erreur de parsing JSON");
      delete parser;
      return;
   }

   JSONObject *jo = jv;
   string command = jo.getString("command");

   if (command == "getBalance") {
      double balance = AccountBalance();
      string payload = "{\"balance\":" + DoubleToString(balance, 2) + "}";
      string postResponse = "";

      if (INet.Request("POST", "/balance", postResponse, false, true, payload, false)) {
         Print("Balance envoyée : ", payload);
      } else {
         Print("Erreur envoi balance");
      }
   }

   delete parser;
}
