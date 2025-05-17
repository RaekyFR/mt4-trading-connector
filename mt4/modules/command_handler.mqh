#ifndef __COMMAND_HANDLER_MQH__
#define __COMMAND_HANDLER_MQH__

#include <file_io.mqh>  // Nécessaire pour WriteResponse
#include <json_parser.mqh>

void ProcessCommand(string cmd) {
   if (cmd == "") return;

   // Affichage dans le journal pour débogage
   Print("Commande reçue : ", cmd);

string cmd1 = GetJsonValue(cmd, command)

   if (cmd1 == "getBalance") {
      double balance = AccountBalance();
      WriteResponse("balance", DoubleToString(balance, 2));
   }
   else {
      WriteResponse("error", "Commande inconnue : " + cmd1);
   }
}

#endif
