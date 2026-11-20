-- CreateTable
CREATE TABLE "PlayerHour" (
    "server" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "since" TIMESTAMP(3) NOT NULL,
    "field" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PlayerHour_pkey" PRIMARY KEY ("server","playerId","at")
);

-- CreateTable
CREATE TABLE "ProbableFlood" (
    "id" SERIAL NOT NULL,
    "server" TEXT NOT NULL,
    "since" TIMESTAMP(3) NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "victimId" INTEGER NOT NULL,
    "victimAlliance" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "attackers" INTEGER[],
    "candidates" INTEGER[],
    "alliance" TEXT,
    "sureness" TEXT NOT NULL,

    CONSTRAINT "ProbableFlood_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerHour_server_at_idx" ON "PlayerHour"("server", "at");

-- CreateIndex
CREATE INDEX "ProbableFlood_server_victimId_at_idx" ON "ProbableFlood"("server", "victimId", "at");

-- CreateIndex
CREATE INDEX "ProbableFlood_server_at_idx" ON "ProbableFlood"("server", "at");

-- CreateIndex
CREATE INDEX "ProbableFlood_attackers_idx" ON "ProbableFlood" USING GIN ("attackers");
