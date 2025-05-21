#ifndef __MARKET_ORDER_MQH__
#define __MARKET_ORDER_MQH__

#include <json_parser.mqh>
#include <file_io.mqh>
#include <error_utils.mqh>

void ExecuteMarketOrder(string json, string id) {
   string symbol = GetJsonValue(json, "symbol");
   string typeStr = GetJsonValue(json, "type");
   double lot = GetJsonNumber(json, "lot");
   double sl = GetJsonNumber(json, "sl");
   double tp = GetJsonNumber(json, "tp");
   string comment = GetJsonValue(json, "comment");

   Print("market order : "+symbol+" "+typeStr+" "+lot+" "+sl+" "+tp+" "+comment);

   int type = -1;
   if (typeStr == "buy") type = OP_BUY;
   else if (typeStr == "sell") type = OP_SELL;
   else {
      WriteResponse("error", "{\"id\":\"" + id + "\",\"error\":\"Type d'ordre invalide\"}");
      return;
   }

   if (lot <= 0 || symbol == "") {
      WriteResponse("error", "{\"id\":\"" + id + "\",\"error\":\"Paramètres invalides\"}");
      return;
   }

   double price = (type == OP_BUY) ? MarketInfo(symbol, MODE_ASK) : MarketInfo(symbol, MODE_BID);
   double slPrice = 0;
   double tpPrice = 0;

   if (sl > 0) {
      slPrice = (type == OP_BUY) ? price - sl * Point : price + sl * Point;
   }

   if (tp > 0) {
      tpPrice = (type == OP_BUY) ? price + tp * Point : price - tp * Point;
   }

   int ticket = OrderSend(symbol, type, lot, price, 3, slPrice, tpPrice, comment, 0, 0, clrGreen);

   if (ticket < 0) {
     // int errCode = GetLastError();
     // string err = "Erreur OrderSend (" + IntegerToString(errCode) + ")";
      string errorMsg = GetErrorText(GetLastError());
      string err = "Erreur OrderSend (" + errorMsg + ")";
      WriteResponse("error", "{\"id\":\"" + id + "\",\"error\":\"" + err + "\"}");

   } else {
      WriteResponse("result", "{\"id\":\"" + id + "\",\"ticket\":" + IntegerToString(ticket) + "}");
   }
}
#endif
