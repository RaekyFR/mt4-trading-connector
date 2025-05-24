#ifndef __CLOSE_ALL_MARKET_ORDERS_MQH__
#define __CLOSE_ALL_MARKET_ORDERS_MQH__

#include <file_io.mqh>
#include <error_utils.mqh>

void ExecuteCloseAllMarketOrders(string json, string id) {
   int totalOrders = OrdersTotal();
   int closedCount = 0;
   int errorsCount = 0;

   for (int i = totalOrders - 1; i >= 0; i--) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      
      int type = OrderType();
      if (type != OP_BUY && type != OP_SELL) continue;

      bool result = false;
      double price = (type == OP_BUY) ? Bid : Ask;
      int slippage = 3;

      result = OrderClose(OrderTicket(), OrderLots(), price, slippage, clrRed);

      if (result) {
         closedCount++;
      } else {
         errorsCount++;
         Print("Erreur fermeture ordre ", OrderTicket(), " : ", GetErrorText(GetLastError()));
      }
   }

  /* string response = "{\"id\":\"" + id + "\",\"closed\":" + IntegerToString(closedCount) + ",\"errors\":" + IntegerToString(errorsCount) + "}";
   WriteResponse("result", response);*/
   string response = "{\"closed\":" + IntegerToString(closedCount) + ",\"errors\":" + IntegerToString(errorsCount) + "}";
   WriteResponse(id, response);
}

#endif
