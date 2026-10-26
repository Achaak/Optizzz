-- CreateTable
CREATE TABLE "accounts"."space_discord" (
    "spaceId" TEXT NOT NULL,
    "blob" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "refusedRevision" INTEGER,
    "refusedStatus" INTEGER,
    "refusedAt" TIMESTAMP(3),
    "refusedByPseudo" TEXT,

    CONSTRAINT "space_discord_pkey" PRIMARY KEY ("spaceId")
);

-- AddForeignKey
ALTER TABLE "accounts"."space_discord" ADD CONSTRAINT "space_discord_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "accounts"."space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
