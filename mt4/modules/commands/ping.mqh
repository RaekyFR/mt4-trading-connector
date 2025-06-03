#ifndef __PING_MQH__
#define __PING_MQH__

void ExecutePing(string json, string id) {
       Print("envoie de la reponse ping");
   string response = "{\"id\":\"" + id + "\",\"result\":\"pong\"}";
   int fileHandle = FileOpen("response-ping.txt", FILE_WRITE | FILE_TXT);
   if (fileHandle != INVALID_HANDLE) {
      FileWrite(fileHandle, response);
      FileClose(fileHandle);
   }
}
#endif
