-- CreateTable
CREATE TABLE "accounts"."extension_token" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "extension_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts"."declared_player" (
    "server" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "pseudo" TEXT NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "declared_player_pkey" PRIMARY KEY ("server","playerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "extension_token_tokenHash_key" ON "accounts"."extension_token"("tokenHash");

-- CreateIndex
CREATE INDEX "extension_token_userId_idx" ON "accounts"."extension_token"("userId");

-- CreateIndex
CREATE INDEX "declared_player_userId_idx" ON "accounts"."declared_player"("userId");

-- AddForeignKey
ALTER TABLE "accounts"."extension_token" ADD CONSTRAINT "extension_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "accounts"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."declared_player" ADD CONSTRAINT "declared_player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "accounts"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
