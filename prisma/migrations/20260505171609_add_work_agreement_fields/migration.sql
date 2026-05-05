-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "clientAcceptedAt" TIMESTAMPTZ,
ADD COLUMN     "creatorAcceptedAt" TIMESTAMPTZ,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "deadline" DATE,
ADD COLUMN     "deliverables" TEXT,
ADD COLUMN     "priceCents" INTEGER,
ADD COLUMN     "revisionRounds" INTEGER,
ADD COLUMN     "scope" TEXT,
ADD COLUMN     "usageRights" "UsageRights";
