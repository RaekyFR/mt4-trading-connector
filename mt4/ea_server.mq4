#property strict

#include <init.mqh>
#include <file_io.mqh>
#include <command_handler.mqh>

int OnInit() {
   return InitEA();
}

void OnDeinit(const int reason) {
   CleanupEA();
}

void OnTimer() {
   string command = ReadCommand();
   ProcessCommand(command);
}
