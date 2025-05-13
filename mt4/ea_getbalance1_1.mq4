#property strict

#include <stdlib.mqh>
#include <WinUser32.mqh>
#include <stderror.mqh>

input string fileCommand = "command.txt";
input string fileResponse = "response.txt";

// Ce fichier est lu/écrit dans le dossier "Files" de MT4
int OnInit() {
   EventSetTimer(1);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
   EventKillTimer();
}

string StringTrim(string str) {
   return StringTrimLeft(StringTrimRight(str));
   }

void OnTimer() {
   string commandPath = fileCommand;
   string responsePath = fileResponse;

   int handle = FileOpen(commandPath, FILE_READ | FILE_TXT);
   if (handle == INVALID_HANDLE) return;

   string raw = FileReadString(handle);
   FileClose(handle);

   if (StringLen(raw) < 5) return;

   string id = "", cmd = "";
   int idStart = StringFind(raw, "\"id\":\"");
   int cmdStart = StringFind(raw, "\"command\":\"");

   if (idStart >= 0 && cmdStart >= 0) {
      idStart += 6;
      int idEnd = StringFind(raw, "\"", idStart);
      id = StringSubstr(raw, idStart, idEnd - idStart);

      cmdStart += 10;
      int cmdEnd = StringFind(raw, "\"", cmdStart);
      cmd = StringSubstr(raw, cmdStart, cmdEnd - cmdStart);
   }

   if (id == "" || cmd == "") return;

   double result = 0;

   if (cmd == "getBalance") {
      result = AccountBalance();
   } else if (cmd == "getEquity") {
      result = AccountEquity();
   } else if (cmd == "getFreeMargin") {
      result = AccountFreeMargin();
   } else {
      Print("Commande non reconnue : ", cmd);
      return;
   }

   string response = "{\"id\":\"" + id + "\",\"result\":" + DoubleToString(result, 2) + "}";

   int handleOut = FileOpen(responsePath, FILE_WRITE | FILE_TXT);
   if (handleOut != INVALID_HANDLE) {
      FileWrite(handleOut, response);
      FileClose(handleOut);
      Print("Réponse envoyée : ", response);
   } else {
      Print("Erreur d’écriture de la réponse");
   }

   FileDelete(commandPath);  // Nettoyage
}
