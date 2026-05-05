-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "paidAt" TIMESTAMPTZ,
ADD COLUMN     "payoutReleasedAt" TIMESTAMPTZ,
ADD COLUMN     "payoutScheduledFor" TIMESTAMPTZ,
ADD COLUMN     "stripeCheckoutSessionId" TEXT;
