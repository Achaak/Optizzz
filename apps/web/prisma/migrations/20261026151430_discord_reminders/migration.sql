-- CreateTable
CREATE TABLE "accounts"."space_reminders" (
    "spaceId" TEXT NOT NULL,
    "sealedUrl" TEXT NOT NULL,
    "kinds" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "suspendedStatus" INTEGER,
    "suspendedAt" TIMESTAMP(3),

    CONSTRAINT "space_reminders_pkey" PRIMARY KEY ("spaceId")
);

-- CreateTable
CREATE TABLE "accounts"."space_reminder_sent" (
    "spaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_reminder_sent_pkey" PRIMARY KEY ("spaceId","kind")
);

-- AddForeignKey
ALTER TABLE "accounts"."space_reminders" ADD CONSTRAINT "space_reminders_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "accounts"."space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"."space_reminder_sent" ADD CONSTRAINT "space_reminder_sent_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "accounts"."space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
