#property strict

#include <init.mqh>
#include <file_io.mqh>
#include <command_handler.mqh>

// ✅ VARIABLES GLOBALES AMÉLIORÉES
int pingCounter = 0;
int totalCommandsProcessed = 0;
datetime lastCommandTime = 0;
bool debugMode = true; // Mettre à false en production

int OnInit() {
   Print("[EA_SERVER] Initialisation de l'EA Bridge MT4...");
   Print("[EA_SERVER] Version: 2.0 - Phase 1 Corrigée");
   Print("[EA_SERVER] Debug mode: ", debugMode ? "ON" : "OFF");
   
   int result = InitEA();
   
   if (result == INIT_SUCCEEDED) {
      Print("[EA_SERVER] ✅ Initialisation réussie");
      Print("[EA_SERVER] Timer configuré sur 1 seconde");
      Print("[EA_SERVER] Ping séparé maintenu (toutes les 10 cycles)");
   } else {
      Print("[EA_SERVER] ❌ Échec initialisation");
   }
   
   return result;
}

void OnDeinit(const int reason) {
   Print("[EA_SERVER] Arrêt de l'EA Bridge MT4...");
   Print("[EA_SERVER] Raison: ", reason);
   Print("[EA_SERVER] Total commandes traitées: ", totalCommandsProcessed);
   
   CleanupEA();
   
   Print("[EA_SERVER] ✅ Nettoyage terminé");
}

// ✅ ONTIMER AMÉLIORÉ - Avec gestion d'erreurs et stats
void OnTimer() {
   // Traitement des commandes principales
   string command = ReadCommand();
   
   if (StringLen(command) > 0) {
      if (debugMode) {
         Print("[EA_SERVER] Commande reçue: ", StringSubstr(command, 0, 100), 
               StringLen(command) > 100 ? "..." : "");
      }
      
      ProcessCommandSafe(command);
      totalCommandsProcessed++;
      lastCommandTime = TimeCurrent();
   }
   
   // Gestion du ping séparé (comme demandé)
   pingCounter++;
   
   if (pingCounter >= 10) {
      string pingCmd = ReadPingCommand();
      
      if (StringLen(pingCmd) > 0) {
         if (debugMode) {
            Print("[EA_SERVER] Ping reçu: ", pingCmd);
         }
         
         ProcessPingCommand(pingCmd);
      }
      
      pingCounter = 0;
   }
   
   // Debug info périodique
   if (debugMode && totalCommandsProcessed > 0 && totalCommandsProcessed % 50 == 0) {
      Print("[EA_SERVER] Stats: ", totalCommandsProcessed, " commandes traitées");
      Print("[EA_SERVER] Dernière commande: ", TimeToString(lastCommandTime));
      Print("[EA_SERVER] Ping counter: ", pingCounter);
   }
}

// ✅ NOUVELLE FONCTION - Gestion d'événements de trading
void OnTrade() {
   static int lastOrdersTotal = -1;
   int currentOrdersTotal = OrdersTotal();
   
   if (lastOrdersTotal != -1 && currentOrdersTotal != lastOrdersTotal) {
      if (currentOrdersTotal > lastOrdersTotal) {
         Print("[EA_SERVER] 📈 Nouvel ordre détecté. Total: ", currentOrdersTotal);
      } else {
         Print("[EA_SERVER] 📉 Ordre fermé détecté. Total: ", currentOrdersTotal);
      }
   }
   
   lastOrdersTotal = currentOrdersTotal;
}

// ✅ NOUVELLE FONCTION - Gestion d'événements de tick (optionnel)
void OnTick() {
   // Ne rien faire par défaut pour éviter la surcharge
   // Peut être utilisé pour du monitoring temps réel si nécessaire
}

// ✅ NOUVELLE FONCTION - Helper pour debug
void PrintSystemInfo() {
   Print("[EA_SERVER] === INFORMATIONS SYSTÈME ===");
   Print("[EA_SERVER] Compte: ", AccountNumber());
   Print("[EA_SERVER] Serveur: ", AccountServer());
   Print("[EA_SERVER] Balance: ", AccountBalance());
   Print("[EA_SERVER] Connexion: ", IsConnected() ? "✅" : "❌");
   Print("[EA_SERVER] Trading autorisé: ", IsTradeAllowed() ? "✅" : "❌");
   Print("[EA_SERVER] Ordres ouverts: ", OrdersTotal());
   Print("[EA_SERVER] ===============================");
}

// ✅ FONCTION D'INITIALISATION ÉTENDUE
void OnStart() {
   // Cette fonction est appelée si l'EA est lancé comme script
   Print("[EA_SERVER] Démarrage en mode script");
   PrintSystemInfo();
}