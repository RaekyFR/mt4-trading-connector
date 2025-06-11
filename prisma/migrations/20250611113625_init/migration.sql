-- CreateTable
CREATE TABLE "Symbol" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbolId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signal_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StrategyRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "strategyId" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "StrategyRule_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "strategyId" INTEGER NOT NULL,
    "signalId" INTEGER,
    "symbolId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "lot" REAL NOT NULL,
    "sl" REAL NOT NULL,
    "tp" REAL NOT NULL,
    "ticketMt4" INTEGER,
    "comment" TEXT,
    "state" TEXT NOT NULL,
    "openedAt" DATETIME,
    "closedAt" DATETIME,
    CONSTRAINT "Order_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Symbol_name_key" ON "Symbol"("name");
