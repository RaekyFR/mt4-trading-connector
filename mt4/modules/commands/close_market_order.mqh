#ifndef __CLOSE_MARKET_ORDER_MQH__
#define __CLOSE_MARKET_ORDER_MQH__

#include <json_parser.mqh>
#include <file_io.mqh>
#include <error_utils.mqh>

void ExecuteCloseMarketOrder(string json, string id) {
   int ticket = (int)GetJsonNumber(json, "ticket");

   if (ticket <= 0) {
      WriteResponse(id, "{\"error\":\"Ticket invalide\"}");
      return;
   }

   if (!OrderSelect(ticket, SELECT_BY_TICKET)) {
      WriteResponse(id, "{\"error\":\"Ordre introuvable\"}");
      return;
   }

   int type = OrderType();
   if (type != OP_BUY && type != OP_SELL) {
      WriteResponse(id, "\"error\":\"L'ordre n'est pas un ordre marché\"}");
      return;
   }

   double price = (type == OP_BUY) ? Bid : Ask;
   bool result = OrderClose(ticket, OrderLots(), price, 3, clrRed);

   if (result) {
      WriteResponse(id,"{\"ticket\":" + IntegerToString(ticket) + ",\"status\":\"fermé\"}");
   } else {
      int errCode = GetLastError();
      WriteResponse(id, "{\"ticket\":" + IntegerToString(ticket) + ",\"error\":\"" + GetErrorText(errCode) + "\"}");
   }
}

#endif
