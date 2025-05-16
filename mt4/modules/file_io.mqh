#ifndef __FILE_IO_MQH__
#define __FILE_IO_MQH__

#define READ_FILE   "command.txt"
#define WRITE_FILE  "response.txt"

// Lit une commande depuis le fichier command.txt
string ReadCommand() {
   int fileHandle = FileOpen(READ_FILE, FILE_READ | FILE_TXT);
   if (fileHandle == INVALID_HANDLE)
      return "";

   string command = FileReadString(fileHandle);
   FileClose(fileHandle);
   return StringTrim(command);
}

// Écrit une réponse dans response.txt
void WriteResponse(string label, string value) {
   int fileHandle = FileOpen(WRITE_FILE, FILE_WRITE | FILE_TXT);
   if (fileHandle == INVALID_HANDLE)
      return;

   string output = label + "," + value;
   FileWrite(fileHandle, output);
   FileClose(fileHandle);
}

// Supprime les espaces ou caractères parasites
string StringTrim(string str) {
   return StringTrimLeft(StringTrimRight(str));
}

#endif
