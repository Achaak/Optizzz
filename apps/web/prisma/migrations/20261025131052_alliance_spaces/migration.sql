-- CreateEnum
CREATE TYPE "accounts"."SpaceRole" AS ENUM ('admin', 'delegate', 'member');

-- CreateEnum
CREATE TYPE "accounts"."JoinRequestStatus" AS ENUM ('pending', 'refused');

-- CreateTable
CREATE TABLE "accounts"."personal_key" (
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "lockedPrivateKey" TEXT NOT NULL,
    "trustList" TEXT,
    "trustListRevision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_key_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "accounts"."space" (
    "id" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts"."space_member" (
    "spaceId" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "role" "accounts"."SpaceRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicKey" TEXT NOT NULL,

    CONSTRAINT "space_member_pkey" PRIMARY KEY ("spaceId","server","playerId")
);

-- CreateTable
CREATE TABLE "accounts"."sealed_alliance_key" (
    "spaceId" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "sealed" TEXT NOT NULL,
    "sealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sealed_alliance_key_pkey" PRIMARY KEY ("spaceId","server","playerId","version")
);

-- CreateTable
CREATE TABLE "accounts"."join_request" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "status" "accounts"."JoinRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "join_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts"."space_certificate" (
    "spaceId" TEXT NOT NULL,
    "blob" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "space_certificate_pkey" PRIMARY KEY ("spaceId","blob")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_key_publicKey_key" ON "accounts"."personal_key"("publicKey");

-- CreateIndex
CREATE INDEX "space_server_tag_idx" ON "accounts"."space"("server", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "space_member_server_playerId_key" ON "accounts"."space_member"("server", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "join_request_spaceId_server_playerId_key" ON "accounts"."join_request"("spaceId", "server", "playerId");

-- AddForeignKey
ALTER TABLE "accounts"."personal_key" ADD CONSTRAINT "personal_key_userId_fkey" FOREIGN KEY ("userId") REFERENCES "accounts"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."space_member" ADD CONSTRAINT "space_member_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "accounts"."space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."space_member" ADD CONSTRAINT "space_member_server_playerId_fkey" FOREIGN KEY ("server", "playerId") REFERENCES "accounts"."declared_player"("server", "playerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."sealed_alliance_key" ADD CONSTRAINT "sealed_alliance_key_spaceId_server_playerId_fkey" FOREIGN KEY ("spaceId", "server", "playerId") REFERENCES "accounts"."space_member"("spaceId", "server", "playerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."join_request" ADD CONSTRAINT "join_request_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "accounts"."space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."join_request" ADD CONSTRAINT "join_request_server_playerId_fkey" FOREIGN KEY ("server", "playerId") REFERENCES "accounts"."declared_player"("server", "playerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."space_certificate" ADD CONSTRAINT "space_certificate_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "accounts"."space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
