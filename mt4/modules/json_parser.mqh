#ifndef __JSON_PARSER_MQH__
#define __JSON_PARSER_MQH__

// Fonction : extrait la valeur d'une clé dans une chaîne JSON simple
string GetJsonValue(string json, string key) {
   string pattern = "\"" + key + "\"";
   int keyPos = StringFind(json, pattern);
   if (keyPos == -1) return "";

   int colonPos = StringFind(json, ":", keyPos);
   if (colonPos == -1) return "";

   int startQuote = StringFind(json, "\"", colonPos + 1);
   if (startQuote == -1) return "";

   int endQuote = StringFind(json, "\"", startQuote + 1);
   if (endQuote == -1) return "";

   return StringSubstr(json, startQuote + 1, endQuote - startQuote - 1);
}

#endif
