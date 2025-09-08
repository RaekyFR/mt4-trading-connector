/*
  Warnings:

  - You are about to drop the `StrategyRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Symbol` table. If the table is not empty, all the data it contains will be lost.
  - The primary key for the `Order` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `closedAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `comment` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `lot` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `openedAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `signalCloseId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `signalOpenId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `sl` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `symbolId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `ticketMt4` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `tp` on the `Order` table. All the data in the column will be lost.
  - The primary key for the `Signal` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `comment` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `confidence` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `direction` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `entryPrice` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `lot` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `receivedAt` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `sl` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `symbolId` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `tp` on the `Signal` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Signal` table. All the data in the column will be lost.
  - The primary key for the `Strategy` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `lots` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `symbol` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Made the column `strategyId` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `rawData` to the `Signal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `symbol` to the `Signal` table without a default value. This is not possible if the table is not empty.
  - Made the column `strategyId` on table `Signal` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `allowedSymbols` to the `Strategy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Strategy` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Symbol_name_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "StrategyRule";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Symbol";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "RiskMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT,
    "balance" REAL NOT NULL,
    "equity" REAL NOT NULL,
    "margin" REAL NOT NULL,
    "freeMargin" REAL NOT NULL,
    "marginLevel" REAL,
    "openPositions" INTEGER NOT NULL,
    "totalExposure" REAL NOT NULL,
    "totalRisk" REAL NOT NULL,
    "dailyPnL" REAL NOT NULL,
    "weeklyPnL" REAL NOT NULL,
    "monthlyPnL" REAL NOT NULL,
    "correlationData" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskMetric_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyId" TEXT,
    "maxDailyLoss" REAL NOT NULL DEFAULT 5.0,
    "maxWeeklyLoss" REAL NOT NULL DEFAULT 10.0,
    "maxMonthlyLoss" REAL NOT NULL DEFAULT 20.0,
    "maxDrawdown" REAL NOT NULL DEFAULT 15.0,
    "maxTotalPositions" INTEGER NOT NULL DEFAULT 5,
    "maxPositionsPerSymbol" INTEGER NOT NULL DEFAULT 2,
    "maxLotSize" REAL NOT NULL DEFAULT 1.0,
    "maxTotalExposure" REAL NOT NULL DEFAULT 5.0,
    "defaultRiskPercent" REAL NOT NULL DEFAULT 1.0,
    "maxRiskPercent" REAL NOT NULL DEFAULT 2.0,
    "useKellyCriterion" BOOLEAN NOT NULL DEFAULT false,
    "maxCorrelation" REAL NOT NULL DEFAULT 0.7,
    "correlationPeriod" INTEGER NOT NULL DEFAULT 20,
    "tradingHours" TEXT,
    "blockedDates" TEXT,
    "stopTradingOnLoss" BOOLEAN NOT NULL DEFAULT true,
    "requireConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiskConfig_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "userId" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AccountState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountNumber" INTEGER,
    "broker" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "balance" REAL NOT NULL,
    "equity" REAL NOT NULL,
    "margin" REAL NOT NULL,
    "freeMargin" REAL NOT NULL,
    "marginLevel" REAL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" REAL,
    "profitFactor" REAL,
    "sharpeRatio" REAL,
    "lastUpdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signalId" TEXT,
    "strategyId" TEXT NOT NULL,
    "ticket" INTEGER,
    "symbol" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "lots" REAL NOT NULL,
    "openPrice" REAL,
    "closePrice" REAL,
    "stopLoss" REAL,
    "takeProfit" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "mt4Status" TEXT,
    "profit" REAL,
    "commission" REAL,
    "swap" REAL,
    "riskAmount" REAL,
    "riskPercent" REAL,
    "openTime" DATETIME,
    "closeTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Order_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("id", "strategyId", "type") SELECT "id", "strategyId", "type" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_ticket_key" ON "Order"("ticket");
CREATE TABLE "new_Signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" REAL,
    "stopLoss" REAL,
    "takeProfit" REAL,
    "suggestedLot" REAL,
    "calculatedLot" REAL,
    "riskAmount" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processedAt" DATETIME,
    "errorMessage" TEXT,
    "rawData" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'tradingview',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signal_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Signal" ("action", "id", "source", "strategyId") SELECT "action", "id", coalesce("source", 'tradingview') AS "source", "strategyId" FROM "Signal";
DROP TABLE "Signal";
ALTER TABLE "new_Signal" RENAME TO "Signal";
CREATE TABLE "new_Strategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxDailyLoss" REAL,
    "maxPositions" INTEGER NOT NULL DEFAULT 1,
    "maxLotSize" REAL NOT NULL DEFAULT 0.1,
    "defaultRiskPercent" REAL NOT NULL DEFAULT 1.0,
    "riskRewardRatio" REAL DEFAULT 2.0,
    "allowedSymbols" TEXT NOT NULL,
    "tradingHours" TEXT,
    "tradingDays" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Strategy" ("createdAt", "id", "isActive", "name") SELECT "createdAt", "id", "isActive", "name" FROM "Strategy";
DROP TABLE "Strategy";
ALTER TABLE "new_Strategy" RENAME TO "Strategy";
CREATE UNIQUE INDEX "Strategy_name_key" ON "Strategy"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RiskMetric_timestamp_idx" ON "RiskMetric"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AccountState_lastUpdate_idx" ON "AccountState"("lastUpdate");
