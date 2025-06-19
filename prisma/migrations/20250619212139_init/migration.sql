/*
  Warnings:

  - You are about to drop the column `signalId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `Signal` table. All the data in the column will be lost.
  - Added the required column `action` to the `Signal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Signal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `StrategyRule` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbolId" INTEGER NOT NULL,
    "strategyId" INTEGER,
    "signalOpenId" INTEGER,
    "signalCloseId" INTEGER,
    "ticketMt4" INTEGER,
    "comment" TEXT,
    "lot" REAL NOT NULL,
    "sl" REAL,
    "tp" REAL,
    "type" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "openedAt" DATETIME,
    "closedAt" DATETIME,
    CONSTRAINT "Order_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_signalOpenId_fkey" FOREIGN KEY ("signalOpenId") REFERENCES "Signal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_signalCloseId_fkey" FOREIGN KEY ("signalCloseId") REFERENCES "Signal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("closedAt", "comment", "id", "lot", "openedAt", "sl", "state", "strategyId", "symbolId", "ticketMt4", "tp", "type") SELECT "closedAt", "comment", "id", "lot", "openedAt", "sl", "state", "strategyId", "symbolId", "ticketMt4", "tp", "type" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE TABLE "new_Signal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbolId" INTEGER NOT NULL,
    "strategyId" INTEGER,
    "action" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entryPrice" REAL,
    "sl" REAL,
    "tp" REAL,
    "lot" REAL,
    "comment" TEXT,
    "source" TEXT,
    "confidence" INTEGER,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signal_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Signal_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Signal" ("direction", "id", "receivedAt", "symbolId") SELECT "direction", "id", "receivedAt", "symbolId" FROM "Signal";
DROP TABLE "Signal";
ALTER TABLE "new_Signal" RENAME TO "Signal";
CREATE TABLE "new_StrategyRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "strategyId" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    CONSTRAINT "StrategyRule_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StrategyRule" ("field", "id", "operator", "strategyId", "value") SELECT "field", "id", "operator", "strategyId", "value" FROM "StrategyRule";
DROP TABLE "StrategyRule";
ALTER TABLE "new_StrategyRule" RENAME TO "StrategyRule";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
