#ifndef __LIMIT_ORDER_MQH__
#define __LIMIT_ORDER_MQH__

#include <json_parser.mqh>
#include <file_io.mqh>
#include <error_utils.mqh>

void ExecuteLimitOrder(string json, string id) {
   string symbol = GetJsonValue(json, "symbol");
   string typeStr = GetJsonValue(json, "type");
   double lot = GetJsonNumber(json, "lot");
   double price = GetJsonNumber(json, "price");
   double sl = GetJsonNumber(json, "sl");
   double tp = GetJsonNumber(json, "tp");
   string comment = GetJsonValue(json, "comment");

 Print("market order : "+symbol+" "+typeStr+" "+lot+" "+price+" "+sl+" "+tp+" "+comment);

   int type = -1;
   if (typeStr == "buy limit") type = OP_BUYLIMIT;
   else if (typeStr == "sell limit") type = OP_SELLLIMIT;
   else {
      WriteResponse("error", "{\"id\":\"" + id + "\",\"error\":\"Type d'ordre limite invalide\"}");
      return;
   }

   if (lot <= 0 || symbol == "" || price <= 0) {
      WriteResponse("error", "{\"id\":\"" + id + "\",\"error\":\"Paramètres invalides\"}");
      return;
   }

   // Calcul des stop loss et take profit
   double slPrice = 0;
   double tpPrice = 0;
   if (sl > 0) {
      //slPrice = (type == OP_BUYLIMIT) ? price - sl * Point : price + sl * Point;
      slPrice=sl;
   }
   if (tp > 0) {
     // tpPrice = (type == OP_BUYLIMIT) ? price + tp * Point : price - tp * Point;
     tpPrice=tp;
   }

   int ticket = OrderSend(symbol, type, lot, price, 3, slPrice, tpPrice, comment, 0, 0, clrBlue);

   if (ticket < 0) {
      /*int errCode = GetLastError();
      string err = "Erreur OrderSend : " + GetErrorText(errCode);
      WriteResponse("error", "{\"id\":\"" + id + "\",\"error\":\"" + err + "\"}");*/
      string errorMsg = GetErrorText(GetLastError());
      string err = "Erreur OrderSend (" + errorMsg + ")";
      WriteResponse(id,"{\"error\":\"" + err + "\"}");
   } else {
      //WriteResponse("result", "{\"id\":\"" + id + "\",\"ticket\":" + IntegerToString(ticket) + "}");
      WriteResponse(id,"{\"ticket\":" + IntegerToString(ticket) + "}");
   }
}

#endif
