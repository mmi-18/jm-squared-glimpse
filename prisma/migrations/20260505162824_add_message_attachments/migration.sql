-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
