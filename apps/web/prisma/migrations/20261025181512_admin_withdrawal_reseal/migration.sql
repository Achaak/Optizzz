-- AlterTable
ALTER TABLE "accounts"."space_member" ADD COLUMN     "resendNeeded" BOOLEAN NOT NULL DEFAULT false;
