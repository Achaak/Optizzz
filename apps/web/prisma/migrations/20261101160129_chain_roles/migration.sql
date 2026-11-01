-- CreateTable
CREATE TABLE "accounts"."space_chain_roles" (
    "spaceId" TEXT NOT NULL,
    "blob" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL,
    "savedByPseudo" TEXT NOT NULL,

    CONSTRAINT "space_chain_roles_pkey" PRIMARY KEY ("spaceId")
);

-- AddForeignKey
ALTER TABLE "accounts"."space_chain_roles" ADD CONSTRAINT "space_chain_roles_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "accounts"."space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
