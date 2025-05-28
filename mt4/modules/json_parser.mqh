#ifndef __JSON_PARSER_MQH__
#define __JSON_PARSER_MQH__

// 🔹 Extraction d'une valeur string depuis un JSON simple
string GetJsonValue(string json, string key) {
   Print("dans json_parser GetJsonValue, key :",key);
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

// 🔹 Extraction d'une valeur numérique depuis un JSON simple
double GetJsonNumber(string json, string key) {
      Print("dans json_parser GetJsonNumber, key :",key);
   string pattern = "\"" + key + "\"";
   int keyPos = StringFind(json, pattern);
   if (keyPos == -1) return 0;

   int colonPos = StringFind(json, ":", keyPos);
   if (colonPos == -1) return 0;

   int valueStart = colonPos + 1;

   // Sauter les espaces
   while (StringGetChar(json, valueStart) == ' ') valueStart++;

   int valueEnd = valueStart;
   int jsonLength = StringLen(json);
   while (valueEnd < jsonLength && (
      (StringGetChar(json, valueEnd) >= '0' && StringGetChar(json, valueEnd) <= '9') ||
      StringGetChar(json, valueEnd) == '.' || StringGetChar(json, valueEnd) == '-'))
   {
      valueEnd++;
   }

   string numberStr = StringSubstr(json, valueStart, valueEnd - valueStart);
   Print("dans json_parser GetJsonNumber, key :"+key+" valeur: "+numberStr);
   return StrToDouble(numberStr);
}

#endif
