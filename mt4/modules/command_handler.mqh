#ifndef __COMMAND_HANDLER_MQH__
#define __COMMAND_HANDLER_MQH__

#include <file_io.mqh>  // Nécessaire pour WriteResponse

void ProcessCommand(string cmd) {
   if (cmd == "") return;

   // Affichage dans le journal pour débogage
   Print("Commande reçue : ", cmd);

   if (cmd == "getBalance") {
      double balance = AccountBalance();
      WriteResponse("balance", DoubleToString(balance, 2));
   }
   else {
      WriteResponse("error", "Commande inconnue : " + cmd);
   }
}

#endif
