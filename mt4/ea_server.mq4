#property strict

#include <init.mqh>
#include <file_io.mqh>
#include <command_handler.mqh>
#include <commands/ping.mqh>

int OnInit() {
   return InitEA();
}

void OnDeinit(const int reason) {
   CleanupEA();
}

int pingCounter = 0;

void OnTimer() {
   pingCounter++;
   string command = ReadCommand();
   Print("commande = ", command);
   ProcessCommand(command);
   Print("pingCounter = ", pingCounter);

   if (pingCounter >= 10) {
      string pingCmd = ReadPingCommand(); // lit command-ping.txt
      if (pingCmd != "") {
         ExecutePing(pingCmd, "ping");
      }
      pingCounter = 0;
   }
}
