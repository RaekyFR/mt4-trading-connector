#ifndef __GET_BALANCE_MQH__
#define __GET_BALANCE_MQH__

void ExecuteGetBalance(string id) {
      double balance = AccountBalance();
      WriteResponse("balance", DoubleToString(balance, 2));
      Print("balance : ", balance);
}

#endif