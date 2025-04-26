//+------------------------------------------------------------------+
//|                                                   TCP_Client.mq4 |
//|                        © Ton Projet                              |
//+------------------------------------------------------------------+
#property strict

// --- Paramètres configurables
input string ServerIP = "127.0.0.1";  // IP du serveur Node.js
input int ServerPort = 5000;          // Port du serveur

int socketHandle = INVALID_HANDLE;
bool isConnected = false;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   // Tenter de se connecter
   socketHandle = SocketCreate();
   if(socketHandle == INVALID_HANDLE)
   {
      Print("Erreur création socket : ", GetLastError());
      return INIT_FAILED;
   }

   if(!SocketConnect(socketHandle, ServerIP, ServerPort))
   {
      Print("Erreur connexion serveur : ", GetLastError());
      SocketClose(socketHandle);
      return INIT_FAILED;
   }

   isConnected = true;
   Print("Connexion au serveur établie !");
   
   return INIT_SUCCEEDED;
  }
//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(isConnected)
      SocketClose(socketHandle);
   Print("Socket fermé.");
  }
//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
  {
   if(!isConnected)
      return;
   
   char buffer[512];
   int bytesReceived = SocketRead(socketHandle, buffer, sizeof(buffer));
   
   if(bytesReceived > 0)
   {
      string data = CharArrayToString(buffer, 0, bytesReceived);
      Print("Données reçues : ", data);

      // Ici : parser le JSON et agir
      ParseAndTrade(data);
   }
  }
//+------------------------------------------------------------------+
//| Fonction pour parser et trader                                   |
//+------------------------------------------------------------------+
void ParseAndTrade(string jsonData)
  {
   // Analyse simple du JSON (ici basique, améliorable)
   string symbol = ExtractValue(jsonData, "symbol");
   string action = ExtractValue(jsonData, "action");
   double entry  = StringToDouble(ExtractValue(jsonData, "entry"));
   double sl     = StringToDouble(ExtractValue(jsonData, "sl"));
   double tp     = StringToDouble(ExtractValue(jsonData, "tp"));
   double risk   = StringToDouble(ExtractValue(jsonData, "risk"));
   
   // Calcul lotSize basique (à améliorer plus tard)
   double lotSize = 0.1;

   // Passer l’ordre
   if(action == "buy")
      OrderSend(symbol, OP_BUY, lotSize, Ask, 3, sl, tp, "Buy Order", 0, 0, clrBlue);
   else if(action == "sell")
      OrderSend(symbol, OP_SELL, lotSize, Bid, 3, sl, tp, "Sell Order", 0, 0, clrRed);
  }
//+------------------------------------------------------------------+
//| Fonction utilitaire pour extraire une valeur simple d'un JSON    |
//+------------------------------------------------------------------+
string ExtractValue(string json, string key)
  {
   int start = StringFind(json, "\"" + key + "\":");
   if(start == -1) return "";

   start = StringFind(json, "\"", start + StringLen(key) + 3) + 1;
   int end = StringFind(json, "\"", start);
   if(end == -1) return "";

   return StringSubstr(json, start, end - start);
  }
