#ifndef __GET_BALANCE_MQH__
#define __GET_BALANCE_MQH__
#include <file_io.mqh>

void ExecuteGetBalance(string id) {
      double balance = AccountBalance();
      WriteResponse(id, DoubleToString(balance, 2));
      Print("\"getBalance response\" : ", balance);
}

#endif