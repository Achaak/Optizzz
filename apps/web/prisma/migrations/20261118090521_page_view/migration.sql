-- CreateTable
CREATE TABLE "accounts"."PageView" (
    "day" DATE NOT NULL,
    "page" TEXT NOT NULL,
    "server" TEXT NOT NULL DEFAULT '',
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("day","page","server")
);
