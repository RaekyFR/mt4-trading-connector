#ifndef __JSON_PARSER_NUMBER_MQH__
#define __JSON_PARSER_NUMBER_MQH__

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