#ifndef __CLOSE_PENDING_ORDER_MQH__
#define __CLOSE_PENDING_ORDER_MQH__

#include <json_parser.mqh>
#include <file_io.mqh>
#include <error_utils.mqh>

void ExecuteClosePendingOrder(string json, string id) {
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
   if (type != OP_BUYLIMIT && type != OP_BUYSTOP && type != OP_SELLLIMIT && type != OP_SELLSTOP) {
      WriteResponse(id, "{\"error\":\"L'ordre n'est pas un pending\"}");
      return;
   }

   bool result = OrderDelete(ticket);

   if (result) {
      WriteResponse(id, "{\"ticket\":" + IntegerToString(ticket) + ",\"status\":\"supprimé\"}");
   } else {
      int errCode = GetLastError();
      WriteResponse(id, "{\"error\":\"" + GetErrorText(errCode) + "\"}");
   }
}

#endif
