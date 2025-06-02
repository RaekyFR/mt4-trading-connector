#ifndef __GET_ALL_MARKET_ORDERS_MQH__
#define __GET_ALL_MARKET_ORDERS_MQH__

#include <file_io.mqh>

void ExecuteGetAllMarketOrders(string json, string id) {
   string response = "{\"orders\":[";
   bool first = true;

   for (int i = 0; i < OrdersTotal(); i++) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;

      int type = OrderType();
      if (type != OP_BUY && type != OP_SELL) continue;

      if (!first) response += ",";
      first = false;

      response += "{";
      response += "\"ticket\":" + IntegerToString(OrderTicket()) + ",";
      response += "\"symbol\":\"" + OrderSymbol() + "\",";
      response += "\"type\":" + IntegerToString(type) + ",";
      response += "\"lots\":" + DoubleToString(OrderLots(), 2) + ",";
      response += "\"openPrice\":" + DoubleToString(OrderOpenPrice(), Digits) + ",";
      response += "\"sl\":" + DoubleToString(OrderStopLoss(), Digits) + ",";
      response += "\"tp\":" + DoubleToString(OrderTakeProfit(), Digits) + ",";
      response += "\"profit\":" + DoubleToString(OrderProfit(), 2) + ",";
      response += "\"magic\":" + IntegerToString(OrderMagicNumber());
      response += "}";
   }

   response += "]}";
   WriteResponse(id, response);
}

#endif
