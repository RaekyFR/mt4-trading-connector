//+------------------------------------------------------------------+
//|                                                    ea_server.mq4 |
//|                                  Copyright 2025, TradingView MT4 |
//|                                                                  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, TradingView MT4"
#property link      ""
#property version   "2.00"
#property strict
#property description "EA Bridge TradingView vers MT4 avec Risk Management"
#property description "Version 2.0 - Phase 1 Corrigée"

// ✅ INCLUSIONS - Vérifier que ces fichiers existent dans modules/
#include <modules/init.mqh>
#include <modules/file_io.mqh>
#include <modules/command_handler.mqh>

// ✅ VARIABLES GLOBALES
int pingCounter = 0;
int totalCommandsProcessed = 0;
datetime lastCommandTime = 0;
bool debugMode = true;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
   Print("=== EA SERVER INITIALISATION ===");
   Print("Version: 2.0 - Phase 1 Corrigée");
   Print("Debug mode: ", debugMode ? "ON" : "OFF");
   
   // Test des inclusions
   Print("Test des inclusions...");
   
   int result = InitEA();
   
   if (result == INIT_SUCCEEDED) {
      Print("✅ Initialisation réussie");
      Print("Timer configuré sur 1 seconde");
      Print("Ping séparé maintenu (toutes les 10 cycles)");
      
      // Test écriture fichier
      string testFile = "test_ea_init.txt";
      int handle = FileOpen(testFile, FILE_WRITE|FILE_TXT);
      if (handle != INVALID_HANDLE) {
         FileWrite(handle, "EA Server initialized successfully");
         FileClose(handle);
         Print("✅ Test écriture fichier OK");
      } else {
         Print("❌ Impossible d'écrire fichier test");
      }
   } else {
      Print("❌ Échec initialisation");
   }
   
   return result;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
   Print("=== EA SERVER ARRET ===");
   Print("Raison: ", reason);
   Print("Total commandes traitées: ", totalCommandsProcessed);
   
   CleanupEA();
   Print("✅ Nettoyage terminé");
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer() {
   // Traitement des commandes principales
   string command = ReadCommand();
   
   if (StringLen(command) > 0) {
      if (debugMode) {
         Print("[TIMER] Commande reçue: ", StringSubstr(command, 0, 50), 
               StringLen(command) > 50 ? "..." : "");
      }
      
      ProcessCommandSafe(command);
      totalCommandsProcessed++;
      lastCommandTime = TimeCurrent();
   }
   
   // Gestion du ping séparé
   pingCounter++;
   
   if (pingCounter >= 10) {
      string pingCmd = ReadPingCommand();
      
      if (StringLen(pingCmd) > 0) {
         if (debugMode) {
            Print("[TIMER] Ping reçu: ", pingCmd);
         }
         
         ProcessPingCommand(pingCmd);
      }
      
      pingCounter = 0;
   }
   
   // Stats périodiques
   if (debugMode && totalCommandsProcessed > 0 && totalCommandsProcessed % 50 == 0) {
      Print("[STATS] ", totalCommandsProcessed, " commandes traitées");
      Print("[STATS] Dernière commande: ", TimeToString(lastCommandTime));
   }
}

//+------------------------------------------------------------------+
//| Trade function                                                   |
//+------------------------------------------------------------------+
void OnTrade() {
   static int lastOrdersTotal = -1;
   int currentOrdersTotal = OrdersTotal();
   
   if (lastOrdersTotal != -1 && currentOrdersTotal != lastOrdersTotal) {
      if (currentOrdersTotal > lastOrdersTotal) {
         Print("[TRADE] 📈 Nouvel ordre détecté. Total: ", currentOrdersTotal);
      } else {
         Print("[TRADE] 📉 Ordre fermé détecté. Total: ", currentOrdersTotal);
      }
   }
   
   lastOrdersTotal = currentOrdersTotal;
}

//+------------------------------------------------------------------+
//| ChartEvent function                                             |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam) {
   // Gestion des événements de graphique si nécessaire
   if (id == CHARTEVENT_KEYDOWN) {
      Print("[CHART] Touche pressée: ", lparam);
   }
}

//+------------------------------------------------------------------+
//| Helper function - System info                                   |
//+------------------------------------------------------------------+
void PrintSystemInfo() {
   Print("=== INFORMATIONS SYSTÈME ===");
   Print("Compte: ", AccountNumber());
   Print("Serveur: ", AccountServer());
   Print("Balance: ", AccountBalance());
   Print("Connexion: ", IsConnected() ? "✅" : "❌");
   Print("Trading autorisé: ", IsTradeAllowed() ? "✅" : "❌");
   Print("Ordres ouverts: ", OrdersTotal());
   Print("Heure serveur: ", TimeToString(TimeCurrent()));
   Print("============================");
}