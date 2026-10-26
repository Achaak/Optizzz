-- CreateEnum
CREATE TYPE "accounts"."DemandeStatus" AS ENUM ('pending', 'validated', 'refused', 'closed', 'cancelled');

-- CreateTable
CREATE TABLE "accounts"."demande" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "status" "accounts"."DemandeStatus" NOT NULL DEFAULT 'pending',
    "rank" INTEGER NOT NULL,
    "blob" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedByPseudo" TEXT,
    "endedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "demande_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demande_spaceId_updatedAt_idx" ON "accounts"."demande"("spaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "demande_server_playerId_idx" ON "accounts"."demande"("server", "playerId");

-- AddForeignKey
ALTER TABLE "accounts"."demande" ADD CONSTRAINT "demande_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "accounts"."space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."demande" ADD CONSTRAINT "demande_server_playerId_fkey" FOREIGN KEY ("server", "playerId") REFERENCES "accounts"."declared_player"("server", "playerId") ON DELETE CASCADE ON UPDATE CASCADE;
