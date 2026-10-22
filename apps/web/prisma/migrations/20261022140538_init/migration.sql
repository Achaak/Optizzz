-- CreateTable
CREATE TABLE "ExportRead" (
    "server" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportRead_pkey" PRIMARY KEY ("server","kind")
);

-- CreateTable
CREATE TABLE "Player" (
    "server" TEXT NOT NULL,
    "id" INTEGER NOT NULL,
    "pseudo" TEXT NOT NULL,
    "alliance" TEXT,
    "masterId" INTEGER,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "field" DOUBLE PRECISION NOT NULL,
    "grade" TEXT,
    "buildingScore" INTEGER NOT NULL,
    "technologyScore" INTEGER NOT NULL,
    "trophyScore" INTEGER NOT NULL,
    "onHoliday" BOOLEAN NOT NULL,
    "isBanned" BOOLEAN NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("server","id")
);

-- CreateTable
CREATE TABLE "Alliance" (
    "server" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "playersCount" INTEGER NOT NULL,
    "totalField" DOUBLE PRECISION NOT NULL,
    "totalBuildingScore" INTEGER NOT NULL,
    "totalTechnologyScore" INTEGER NOT NULL,
    "totalTrophyScore" INTEGER NOT NULL,
    "diplomacy" JSONB NOT NULL,

    CONSTRAINT "Alliance_pkey" PRIMARY KEY ("server","tag")
);

-- CreateTable
CREATE TABLE "PlayerDay" (
    "server" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "alliance" TEXT,
    "field" DOUBLE PRECISION NOT NULL,
    "buildingScore" INTEGER NOT NULL,
    "technologyScore" INTEGER NOT NULL,
    "trophyScore" INTEGER NOT NULL,

    CONSTRAINT "PlayerDay_pkey" PRIMARY KEY ("server","playerId","day")
);

-- CreateTable
CREATE TABLE "AllianceDay" (
    "server" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "playersCount" INTEGER NOT NULL,
    "totalField" DOUBLE PRECISION NOT NULL,
    "totalBuildingScore" INTEGER NOT NULL,
    "totalTechnologyScore" INTEGER NOT NULL,
    "totalTrophyScore" INTEGER NOT NULL,

    CONSTRAINT "AllianceDay_pkey" PRIMARY KEY ("server","tag","day")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" SERIAL NOT NULL,
    "server" TEXT NOT NULL,
    "playerId" INTEGER,
    "tag" TEXT,
    "name" TEXT NOT NULL,
    "since" TEXT NOT NULL,
    "until" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "change" JSONB NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Player_server_alliance_idx" ON "Player"("server", "alliance");

-- CreateIndex
CREATE INDEX "Player_server_pseudo_idx" ON "Player"("server", "pseudo");

-- CreateIndex
CREATE INDEX "Player_server_field_idx" ON "Player"("server", "field");

-- CreateIndex
CREATE INDEX "Alliance_server_totalField_idx" ON "Alliance"("server", "totalField");

-- CreateIndex
CREATE INDEX "PlayerDay_server_day_idx" ON "PlayerDay"("server", "day");

-- CreateIndex
CREATE INDEX "AllianceDay_server_day_idx" ON "AllianceDay"("server", "day");

-- CreateIndex
CREATE INDEX "JournalEntry_server_at_idx" ON "JournalEntry"("server", "at");

-- CreateIndex
CREATE INDEX "JournalEntry_server_playerId_at_idx" ON "JournalEntry"("server", "playerId", "at");

-- CreateIndex
CREATE INDEX "JournalEntry_server_tag_at_idx" ON "JournalEntry"("server", "tag", "at");
