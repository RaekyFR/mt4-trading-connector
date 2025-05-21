#ifndef __ERROR_UTILS_MQH__
#define __ERROR_UTILS_MQH__

// Fonction : traduit un code d’erreur MT4 en texte lisible
string GetErrorText(int code) {
   switch (code) {
      case 1:    return "No error";
      case 2:    return "Common error";
      case 3:    return "Invalid trade parameters";
      case 4:    return "Trade server busy";
      case 5:    return "Old client terminal version";
      case 6:    return "No connection to trade server";
      case 8:    return "Too frequent requests";
      case 9:    return "Trade server malfunction";
      case 64:   return "Account disabled";
      case 65:   return "Invalid account";
      case 128:  return "Trade timeout";
      case 129:  return "Invalid price";
      case 130:  return "Invalid stops (SL/TP)";
      case 131:  return "Invalid trade volume";
      case 132:  return "Market closed";
      case 133:  return "Trade disabled";
      case 134:  return "Not enough money";
      case 135:  return "Price changed";
      case 136:  return "Off quotes";
      case 137:  return "Broker busy";
      case 138:  return "Requote";
      case 139:  return "Order locked";
      case 141:  return "Too many requests";
      case 148:  return "Trade context busy";
      case 149:  return "Order send timeout";
      case 150:  return "Invalid order";
      case 4108: return "Invalid ticket";
      default:   return "Unknown error (" + IntegerToString(code) + ")";
   }
}

#endif
