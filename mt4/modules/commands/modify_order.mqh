#ifndef __MODIFY_ORDER_MQH__
#define __MODIFY_ORDER_MQH__

#include <json_parser.mqh>
#include <file_io.mqh>
#include <error_utils.mqh>

void ExecuteModifyOrder(string json, string id) {
   int ticket = (int)GetJsonNumber(json, "ticket");

   if (ticket <= 0) {
      WriteResponse(id ,"{\"error\":\"Ticket invalide\"}");
      return;
   }

   if (!OrderSelect(ticket, SELECT_BY_TICKET)) {
      WriteResponse(id ,"{\"error\":\"Ordre introuvable\"}");
      return;
   }

   double newPrice = OrderOpenPrice();
   double newSl = OrderStopLoss();
   double newTp = OrderTakeProfit();
   datetime newExpiration = OrderExpiration();
   string newComment = OrderComment();

   if (OrderType() == OP_BUYLIMIT || OrderType() == OP_SELLLIMIT || OrderType() == OP_BUYSTOP || OrderType() == OP_SELLSTOP) {
      double price = GetJsonNumber(json, "price");
      if (price > 0) newPrice = price;

      double expiration = GetJsonNumber(json, "expiration");
      if (expiration > 0) newExpiration = (datetime)expiration;
   }

   double sl = GetJsonNumber(json, "sl");
   if (sl > 0) newSl = sl;

   double tp = GetJsonNumber(json, "tp");
   if (tp > 0) newTp = tp;

   string comment = GetJsonValue(json, "comment");
   if (comment != "") newComment = comment;

   bool result = OrderModify(ticket, newPrice, newSl, newTp, newExpiration, clrYellow);

   if (result) {
      WriteResponse(id,"{\"ticket\":" + IntegerToString(ticket) + ",\"status\":\"modifié\"}");
   } else {
      int errCode = GetLastError();
      WriteResponse(id,"{\"error\":\"" + GetErrorText(errCode) + "\"}");
   }
}

#endif
