#ifndef __GET_BALANCE_MQH__
#define __GET_BALANCE_MQH__
#include <file_io.mqh>

void ExecuteGetBalance(string id) {
      double balance = AccountBalance();
      double equity = AccountEquity();
      double margin = AccountMargin();
      double freeMargin = AccountFreeMargin();
double marginLevel = 0;
if (AccountMargin() > 0) {
    marginLevel = (AccountEquity() / AccountMargin()) * 100;
} else {
    marginLevel = 0; // Pas de margin utilisée
}

      string response = "{";
      response += "\"balance\":" + DoubleToString(balance, 2) + ",";
      response += "\"equity\":" + DoubleToString(equity, 2)+ ",";
      response += "\"margin\":" + DoubleToString(margin, 2)+ ",";
      response += "\"freeMargin\":" + DoubleToString(freeMargin, 2)+ ",";
      response += "\"marginLevel\":" + DoubleToString(marginLevel, 2);
      response += "}";
      WriteResponse(id, response);
      Print("\"getBalance response\" : ", response);
}

#endif