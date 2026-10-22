-- CreateTable
CREATE TABLE "MapFile" (
    "server" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "gzip" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapFile_pkey" PRIMARY KEY ("server")
);
