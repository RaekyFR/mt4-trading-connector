#property strict

int OnInit() {
   EventSetTimer(1);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
   EventKillTimer();
}

void OnTimer() {
   string commandFile = "command.txt";
   string responseFile = "response.txt";

   if (!FileIsExist(commandFile)) return;

   int cmdHandle = FileOpen(commandFile, FILE_READ | FILE_TXT);
   if (cmdHandle == INVALID_HANDLE) return;

   string command = FileReadString(cmdHandle);
   FileClose(cmdHandle);

   if (StringTrimLeft(command) == "getBalance") {
      double balance = AccountBalance();
      string response = "{\"balance\":" + DoubleToString(balance, 2) + "}";

      int respHandle = FileOpen(responseFile, FILE_WRITE | FILE_TXT);
      if (respHandle != INVALID_HANDLE) {
         FileWrite(respHandle, response);
         FileClose(respHandle);
         Print("Réponse envoyée : ", response);
      }

      // Nettoyer la commande
      FileDelete(commandFile);
   }
}
