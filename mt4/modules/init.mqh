#ifndef __INIT_MQH__
#define __INIT_MQH__

int InitEA() {
   EventSetTimer(1); // Appelle OnTimer toutes les secondes
   return INIT_SUCCEEDED;
}

void CleanupEA() {
   EventKillTimer();
}

#endif
