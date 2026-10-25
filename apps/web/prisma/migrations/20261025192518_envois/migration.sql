-- AlterTable
ALTER TABLE "accounts"."alliance_key_version" ADD COLUMN     "createdByPseudo" TEXT;

-- CreateTable
CREATE TABLE "accounts"."envoi_settings" (
    "server" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "categories" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envoi_settings_pkey" PRIMARY KEY ("server","playerId")
);

-- CreateTable
CREATE TABLE "accounts"."envoi_item" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "blob" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envoi_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "envoi_item_spaceId_updatedAt_idx" ON "accounts"."envoi_item"("spaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "envoi_item_expiresAt_idx" ON "accounts"."envoi_item"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "envoi_item_spaceId_server_playerId_category_fingerprint_key" ON "accounts"."envoi_item"("spaceId", "server", "playerId", "category", "fingerprint");

-- AddForeignKey
ALTER TABLE "accounts"."envoi_settings" ADD CONSTRAINT "envoi_settings_server_playerId_fkey" FOREIGN KEY ("server", "playerId") REFERENCES "accounts"."declared_player"("server", "playerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."envoi_item" ADD CONSTRAINT "envoi_item_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "accounts"."space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."envoi_item" ADD CONSTRAINT "envoi_item_server_playerId_fkey" FOREIGN KEY ("server", "playerId") REFERENCES "accounts"."declared_player"("server", "playerId") ON DELETE CASCADE ON UPDATE CASCADE;
