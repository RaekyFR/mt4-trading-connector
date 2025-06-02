/*#ifndef __COMMAND_HANDLER_MQH__
#define __COMMAND_HANDLER_MQH__

#include <file_io.mqh>  // Nécessaire pour WriteResponse
#include <json_parser.mqh>

void ProcessCommand(string cmd) {
   if (cmd == "") return;

   // Affichage dans le journal pour débogage
   Print("Commande reçue : ", cmd);

string cmd1 = GetJsonValue(cmd, "command");

   if (cmd1 == "getBalance") {
      double balance = AccountBalance();
      WriteResponse("balance", DoubleToString(balance, 2));
   }
   else {
      WriteResponse("error", "Commande inconnue : " + cmd1);
   }
}

#endif */

#ifndef __COMMAND_HANDLER_MQH__
#define __COMMAND_HANDLER_MQH__

#include <json_parser.mqh>
#include <file_io.mqh>

// Inclusion des commandes spécifiques
#include <commands/market_order.mqh>
#include <commands/limit_order.mqh>
#include <commands/get_balance.mqh>
#include <commands/close_all_market_orders.mqh>
#include <commands/close_market_order.mqh>
#include <commands/close_all_pending_orders.mqh>
#include <commands/close_pending_order.mqh>
// Ajoute ici d'autres commandes au fur et à mesure...

// Fonction principale appelée depuis OnTimer
void ProcessCommand(string json) {
   string id = GetJsonValue(json, "id");
   string cmd = GetJsonValue(json, "command");

   if (id == "" || cmd == "") {
      Print("Commande invalide ou incomplète.");
      return;
   }

   Print("Commande reçue : ", cmd);

   // Dispatch vers la bonne fonction
   if (cmd == "marketOrder") {
      ExecuteMarketOrder(json, id);
   }
      if (cmd == "getBalance") {
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
   else {
      Print("Commande inconnue : ", cmd);
      WriteResponse(id, "{\"error\":\"Commande inconnue\"}");
   }
}

#endif
