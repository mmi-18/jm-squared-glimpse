-- CreateEnum
CREATE TYPE "ReviewDirection" AS ENUM ('client_to_creator', 'creator_to_client');

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "direction" "ReviewDirection",
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "released" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Review_projectId_idx" ON "Review"("projectId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
