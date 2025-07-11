#ifndef __FILE_IO_MQH__
#define __FILE_IO_MQH__

#define READ_FILE   "command.txt"
#define WRITE_FILE  "response.txt"
#define PING_READ_FILE  "command-ping.txt"
#define PING_WRITE_FILE "response-ping.txt"

// ✅ FONCTION CORRIGÉE - Plus de double encapsulation
void WriteResponse(string id, string result) {
   int fileHandle = FileOpen(WRITE_FILE, FILE_WRITE | FILE_TXT);
   if (fileHandle == INVALID_HANDLE) {
      Print("[ERROR] Impossible d'ouvrir le fichier de réponse");
      return;
   }

   // Structure simple : {"id":"...", "result": ...}
   // Le result peut être une string JSON ou une valeur simple
   string output = "{\"id\":\"" + id + "\",\"result\":" + result + "}";
   FileWrite(fileHandle, output);
   FileClose(fileHandle);
   
   Print("[FILE_IO] Réponse écrite pour ID: ", id);
}

// ✅ NOUVELLE FONCTION - WriteResponse spécifique pour ping
void WritePingResponse(string id, string result) {
   int fileHandle = FileOpen(PING_WRITE_FILE, FILE_WRITE | FILE_TXT);
   if (fileHandle == INVALID_HANDLE) {
      Print("[ERROR] Impossible d'ouvrir le fichier de réponse ping");
      return;
   }

   string output = "{\"id\":\"" + id + "\",\"result\":" + result + "}";
   FileWrite(fileHandle, output);
   FileClose(fileHandle);
   
   Print("[FILE_IO] Réponse ping écrite pour ID: ", id);
}

// Lit une commande depuis le fichier command.txt
string ReadCommand() {
   int fileHandle = FileOpen(READ_FILE, FILE_READ | FILE_TXT);
   if (fileHandle == INVALID_HANDLE)
      return "";

   string command = FileReadString(fileHandle);
   FileClose(fileHandle);
   FileDelete(READ_FILE);
   return StringTrim(command);
}

// ✅ FONCTION MAINTENUE - Lecture ping séparée comme demandé
string ReadPingCommand() {
   int fileHandle = FileOpen(PING_READ_FILE, FILE_READ | FILE_TXT);
   if (fileHandle == INVALID_HANDLE) 
      return "";

   string command = FileReadString(fileHandle);
   FileClose(fileHandle);
   FileDelete(PING_READ_FILE);
   return StringTrim(command);
}

// Supprime les espaces ou caractères parasites
string StringTrim(string str) {
   return StringTrimLeft(StringTrimRight(str));
}

// ✅ NOUVELLE FONCTION - Gestion d'erreur améliorée
bool IsFileInUse(string filename) {
   int handle = FileOpen(filename, FILE_READ);
   if (handle == INVALID_HANDLE) {
      return true; // Fichier potentiellement en cours d'utilisation
   }
   FileClose(handle);
   return false;
}

// ✅ NOUVELLE FONCTION - Écriture sécurisée avec retry
bool WriteResponseSafe(string id, string result, int maxRetries = 3) {
   for (int attempt = 0; attempt < maxRetries; attempt++) {
      if (!IsFileInUse(WRITE_FILE)) {
         WriteResponse(id, result);
         return true;
      }
      Sleep(50); // Attendre 50ms avant retry
   }
   
   Print("[ERROR] Impossible d'écrire la réponse après ", maxRetries, " tentatives");
   return false;
}

#endif
