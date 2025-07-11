#ifndef __COMMAND_HANDLER_MQH__
#define __COMMAND_HANDLER_MQH__

#include <json_parser.mqh>
#include <file_io.mqh>

// ✅ CHEMINS CORRIGÉS - Fichiers à la racine, pas dans commands/
#include <commands/market_order.mqh>
#include <commands/limit_order.mqh>
#include <commands/get_balance.mqh>
#include <commands/close_all_market_orders.mqh>
#include <commands/close_market_order.mqh>
#include <commands/close_all_pending_orders.mqh>
#include <commands/close_pending_order.mqh>
#include <commands/get_all_market_orders.mqh>
#include <commands/get_all_pending_orders.mqh>
#include <commands/modify_order.mqh>
#include <commands/ping.mqh>

// ✅ FONCTION AMÉLIORÉE - Gestion d'erreurs et logging
void ProcessCommand(string json) {
   if (StringLen(json) == 0) {
      Print("[COMMAND_HANDLER] Commande vide reçue, ignorée");
      return;
   }
   
   string id = GetJsonValue(json, "id");
   string cmd = GetJsonValue(json, "command");

   if (id == "" || cmd == "") {
      Print("[COMMAND_HANDLER] Commande invalide - ID ou commande manquant");
      Print("[COMMAND_HANDLER] JSON reçu: ", json);
      return;
   }

   Print("[COMMAND_HANDLER] Traitement commande: ", cmd, " (ID: ", id, ")");

   // ✅ DISPATCH AMÉLIORÉ - Avec gestion d'erreurs
   bool commandFound = true;
   
   if (cmd == "marketOrder") {
      ExecuteMarketOrder(json, id);
   }
   else if (cmd == "getBalance") {
      ExecuteGetBalance(id);
   }
   else if (cmd == "limitOrder") {
      ExecuteLimitOrder(json, id);
   }
   else if (cmd == "closeAllMarketOrders") {
      ExecuteCloseAllMarketOrders(json, id);
   }
   else if (cmd == "closeMarketOrder") {
      ExecuteCloseMarketOrder(json, id);
   }
   else if (cmd == "closeAllPendingOrders") {
      ExecuteCloseAllPendingOrders(json, id);
   }
   else if (cmd == "closePendingOrder") {
      ExecuteClosePendingOrder(json, id);
   }
   else if (cmd == "getAllMarketOrders") {
      ExecuteGetAllMarketOrders(json, id);
   }
   else if (cmd == "getAllPendingOrders") {
      ExecuteGetAllPendingOrders(json, id);
   }
   else if (cmd == "modifyOrder") {
      ExecuteModifyOrder(json, id);
   }
   else {
      commandFound = false;
      Print("[COMMAND_HANDLER] Commande inconnue: ", cmd);
      WriteResponse(id, "{\"error\":\"Commande inconnue: " + cmd + "\"}");
   }
   
   if (commandFound) {
      Print("[COMMAND_HANDLER] Commande ", cmd, " exécutée (ID: ", id, ")");
   }
}

// ✅ NOUVELLE FONCTION - Traitement ping séparé
void ProcessPingCommand(string json) {
   if (StringLen(json) == 0) {
      return;
   }
   
   string id = GetJsonValue(json, "id");
   string cmd = GetJsonValue(json, "command");
   
   if (cmd == "ping") {
      Print("[COMMAND_HANDLER] Ping reçu (ID: ", id, ")");
      ExecutePing(json, id);
   } else {
      Print("[COMMAND_HANDLER] Commande ping invalide: ", cmd);
   }
}

// ✅ NOUVELLE FONCTION - Statistiques de commandes
int commandCount = 0;
int errorCount = 0;

void IncrementCommandStats(bool success) {
   commandCount++;
   if (!success) errorCount++;
   
   if (commandCount % 10 == 0) {
      Print("[COMMAND_HANDLER] Stats: ", commandCount, " commandes, ", errorCount, " erreurs");
   }
}

// ✅ NOUVELLE FONCTION - Reset des stats
void ResetCommandStats() {
   commandCount = 0;
   errorCount = 0;
   Print("[COMMAND_HANDLER] Stats réinitialisées");
}

// ✅ NOUVELLE FONCTION - Validation JSON basique
bool IsValidCommandJSON(string json) {
   // Vérifications basiques
   if (StringLen(json) < 10) return false;
   if (StringFind(json, "{") != 0) return false;
   if (StringFind(json, "}") == -1) return false;
   if (StringFind(json, "\"id\"") == -1) return false;
   if (StringFind(json, "\"command\"") == -1) return false;
   
   return true;
}

// ✅ FONCTION WRAPPER - ProcessCommand avec validation
void ProcessCommandSafe(string json) {
   if (!IsValidCommandJSON(json)) {
      Print("[COMMAND_HANDLER] JSON invalide reçu: ", json);
      IncrementCommandStats(false);
      return;
   }
   
   ProcessCommand(json);
   IncrementCommandStats(true);
}

#endif
