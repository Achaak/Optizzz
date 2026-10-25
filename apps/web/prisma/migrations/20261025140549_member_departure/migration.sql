-- CreateTable
CREATE TABLE "accounts"."alliance_key_version" (
    "spaceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alliance_key_version_pkey" PRIMARY KEY ("spaceId","version")
);

-- CreateTable
CREATE TABLE "accounts"."space_absence_alerts" (
    "spaceId" TEXT NOT NULL,
    "blob" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_absence_alerts_pkey" PRIMARY KEY ("spaceId")
);

-- AddForeignKey
ALTER TABLE "accounts"."alliance_key_version" ADD CONSTRAINT "alliance_key_version_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "accounts"."space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."space_absence_alerts" ADD CONSTRAINT "space_absence_alerts_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "accounts"."space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The versions of the spaces created before this migration: every version sealed for one of their members.
INSERT INTO "accounts"."alliance_key_version" ("spaceId", "version")
SELECT DISTINCT "spaceId", "version" FROM "accounts"."sealed_alliance_key"
ON CONFLICT DO NOTHING;
