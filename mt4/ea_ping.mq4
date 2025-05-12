#property strict

input string folderPath = "C:\Users\cyril\mexc\tv_mt4"; // À adapter à ton système

int OnInit() {
   EventSetTimer(1);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
   EventKillTimer();
}

void OnTimer() {
   string filename = folderPath + "ping.txt";
   string lockfile = folderPath + "ping.lock";

   // Vérifie s’il n'y a pas un verrou actif
   if (FileIsExist(lockfile)) return;

   // Crée le fichier de verrouillage
   int lockHandle = FileOpen(lockfile, FILE_WRITE | FILE_TXT);
   if (lockHandle != INVALID_HANDLE) {
      FileClose(lockHandle);
   }

   // Écrit "ping" et le timestamp dans ping.txt
   int fileHandle = FileOpen(filename, FILE_WRITE | FILE_TXT);
   if (fileHandle != INVALID_HANDLE) {
      string msg = "ping " + TimeToString(TimeLocal(), TIME_SECONDS);
      FileWrite(fileHandle, msg);
      FileClose(fileHandle);
      Print("MT4 a écrit : ", msg);
   }

   // Supprime le verrou
   FileDelete(lockfile);
}
