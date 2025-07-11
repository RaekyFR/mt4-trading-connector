#ifndef __PING_MQH__
#define __PING_MQH__

#include <file_io.mqh>

// ✅ FONCTION CORRIGÉE - Utilise WritePingResponse pour maintenir la séparation
void ExecutePing(string json, string id) {
   Print("[PING] Ping reçu, envoi pong (ID: ", id, ")");
   
   // Utiliser la fonction ping séparée pour éviter les interférences
   WritePingResponse(id, "\"pong\"");
   
   Print("[PING] Pong envoyé pour ID: ", id);
}

// ✅ NOUVELLE FONCTION - Ping avec timestamp pour debug
void ExecutePingWithTimestamp(string json, string id) {
   datetime currentTime = TimeCurrent();
   string timestamp = TimeToString(currentTime, TIME_DATE|TIME_SECONDS);
   
   Print("[PING] Ping avec timestamp reçu (ID: ", id, ")");
   
   string pongResponse = "{\"message\":\"pong\",\"timestamp\":\"" + timestamp + "\",\"server_time\":" + IntegerToString(currentTime) + "}";
   WritePingResponse(id, pongResponse);
   
   Print("[PING] Pong avec timestamp envoyé pour ID: ", id);
}

// ✅ NOUVELLE FONCTION - Ping de health check
void ExecuteHealthPing(string json, string id) {
   // Vérifier l'état du serveur MT4
   bool isConnected = IsConnected();
   bool isTradeAllowed = IsTradeAllowed();
   double balance = AccountBalance();
   int openOrders = OrdersTotal();
   
   string healthData = "{";
   healthData += "\"status\":\"" + (isConnected ? "connected" : "disconnected") + "\",";
   healthData += "\"trade_allowed\":" + (isTradeAllowed ? "true" : "false") + ",";
   healthData += "\"balance\":" + DoubleToString(balance, 2) + ",";
   healthData += "\"open_orders\":" + IntegerToString(openOrders) + ",";
   healthData += "\"timestamp\":" + IntegerToString(TimeCurrent());
   healthData += "}";
   
   Print("[PING] Health check effectué (ID: ", id, ")");
   WritePingResponse(id, healthData);
}

// ✅ FONCTION HELPER - Détermine le type de ping
void ProcessPingRequest(string json, string id) {
   string pingType = GetJsonValue(json, "type");
   
   if (pingType == "health") {
      ExecuteHealthPing(json, id);
   } else if (pingType == "timestamp") {
      ExecutePingWithTimestamp(json, id);
   } else {
      ExecutePing(json, id); // Ping standard
   }
}

#endif
