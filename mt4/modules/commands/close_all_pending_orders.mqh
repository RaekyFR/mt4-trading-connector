#ifndef __CLOSE_ALL_PENDING_ORDERS_MQH__
#define __CLOSE_ALL_PENDING_ORDERS_MQH__

#include <file_io.mqh>
#include <error_utils.mqh>

void ExecuteCloseAllPendingOrders(string json, string id) {
   int totalOrders = OrdersTotal();
   int deletedCount = 0;
   int errorsCount = 0;

   for (int i = totalOrders - 1; i >= 0; i--) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;

      int type = OrderType();
      if (type != OP_BUYLIMIT && type != OP_BUYSTOP && type != OP_SELLLIMIT && type != OP_SELLSTOP)
         continue;

      bool result = OrderDelete(OrderTicket());

      if (result) {
         deletedCount++;
      } else {
         errorsCount++;
         Print("Erreur suppression ordre ", OrderTicket(), " : ", GetErrorText(GetLastError()));
      }
   }

   string response = "{\"deleted\":" + IntegerToString(deletedCount) + ",\"errors\":" + IntegerToString(errorsCount) + "}";
   WriteResponse(id, response);
}

#endif
