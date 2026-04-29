-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('creator', 'startup');

-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('free', 'pro');

-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('video', 'photo', 'both');

-- CreateEnum
CREATE TYPE "CreativeDiscipline" AS ENUM ('videographer', 'photographer', 'both', 'motion_designer');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('immediately', 'within_1_week', 'within_1_month', 'limited');

-- CreateEnum
CREATE TYPE "Turnaround" AS ENUM ('1_3_days', '1_week', '2_weeks', '1_month', 'flexible');

-- CreateEnum
CREATE TYPE "Travel" AS ENUM ('local_only', 'regional', 'national', 'international', 'worldwide');

-- CreateEnum
CREATE TYPE "Licensing" AS ENUM ('full_buyout', 'limited_usage', 'negotiable');

-- CreateEnum
CREATE TYPE "CompanyStage" AS ENUM ('pre_seed', 'seed', 'series_a', 'series_b_plus', 'established');

-- CreateEnum
CREATE TYPE "BrandGuidelines" AS ENUM ('strict_brand_guide', 'loose_guidelines', 'no_guidelines', 'open_to_suggestions');

-- CreateEnum
CREATE TYPE "UsageRights" AS ENUM ('full_buyout', 'limited_platform', 'time_limited', 'negotiable');

-- CreateEnum
CREATE TYPE "TimelinePattern" AS ENUM ('urgent_1_week', 'standard_2_4_weeks', 'flexible', 'ongoing');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('portfolio_piece', 'job_listing');

-- CreateEnum
CREATE TYPE "Format" AS ENUM ('vertical', 'horizontal', 'square');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "userType" "UserType" NOT NULL,
    "bio" TEXT,
    "locationCity" TEXT,
    "locationCountry" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "culturalMarkets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "membershipTier" "MembershipTier" NOT NULL DEFAULT 'free',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ,
    "refreshTokenExpiresAt" TIMESTAMPTZ,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "userId" TEXT NOT NULL,
    "discipline" "Discipline",
    "contentCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contentStyleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deliverableTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rateMin" INTEGER,
    "rateMax" INTEGER,
    "availability" "Availability",
    "portfolioUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subSpecializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "industryExperience" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minimumAcceptableBudget" INTEGER,
    "typicalTurnaround" "Turnaround",
    "travelWillingness" "Travel",
    "preferredProjectTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unwantedWorkTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "usageLicensingPreference" "Licensing",
    "productionCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "socialHandles" JSONB NOT NULL DEFAULT '{}',
    "creativeDiscipline" "CreativeDiscipline",
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audienceSize" INTEGER,
    "pastBrandCollaborations" TEXT,
    "creativePhilosophy" TEXT,
    "inspirationCreators" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "showreelUrl" TEXT,
    "styleProductionValue" INTEGER,
    "stylePacing" INTEGER,
    "styleFocus" INTEGER,
    "styleFraming" INTEGER,
    "styleStaging" INTEGER,
    "styleColor" INTEGER,
    "styleSound" INTEGER,
    "avgRating" DECIMAL(3,2),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "portfolioLayout" JSONB,
    "aboutLayout" JSONB,

    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StartupProfile" (
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "industry" TEXT,
    "locationMarket" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contactPerson" TEXT,
    "contactRole" TEXT,
    "contactEmail" TEXT,
    "typicalBudgetRangeMin" INTEGER,
    "typicalBudgetRangeMax" INTEGER,
    "projectGoal" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "desiredLookFeeling" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deliverablesNeeded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quantityVolume" INTEGER,
    "deadline" DATE,
    "budgetForProject" INTEGER,
    "contentUsagePlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "companyStage" "CompanyStage",
    "websiteUrl" TEXT,
    "companyDescription" TEXT,
    "contentCategoriesHired" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandLookGuidelines" "BrandGuidelines",
    "language" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetAudience" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qualitiesInCreator" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contentCommunicationGoal" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "successCriteria" TEXT,
    "usageRightsScope" "UsageRights",
    "locationProductionConstraints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "equipmentNeeded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandValues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pastCreatorCollaborations" TEXT,
    "typicalTimelinePattern" "TimelinePattern",
    "brandGuidelinesUrl" TEXT,
    "referenceContentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandDescription" TEXT,
    "styleProductionValue" INTEGER,
    "stylePacing" INTEGER,
    "styleFocus" INTEGER,
    "styleFraming" INTEGER,
    "styleStaging" INTEGER,
    "styleColor" INTEGER,
    "styleSound" INTEGER,

    CONSTRAINT "StartupProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postType" "PostType" NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "thumbnailUrl" TEXT,
    "contentType" TEXT,
    "industry" TEXT,
    "format" "Format",
    "durationSeconds" INTEGER,
    "equipmentUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "styleProductionValue" INTEGER,
    "stylePacing" INTEGER,
    "styleFocus" INTEGER,
    "styleFraming" INTEGER,
    "styleStaging" INTEGER,
    "styleColor" INTEGER,
    "styleSound" INTEGER,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cellLayout" JSONB,
    "previewLayout" JSONB,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "participantA" TEXT NOT NULL,
    "participantB" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION,
    "lastMessageAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "matchScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewedId" TEXT NOT NULL,
    "projectDescription" TEXT,
    "ratingOverall" INTEGER,
    "ratingReliability" INTEGER,
    "ratingQuality" INTEGER,
    "ratingCollaboration" INTEGER,
    "reviewText" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brief" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "referenceImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustrySimilarity" (
    "industryA" TEXT NOT NULL,
    "industryB" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "IndustrySimilarity_pkey" PRIMARY KEY ("industryA","industryB")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_userType_idx" ON "User"("userType");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "Post_userId_idx" ON "Post"("userId");

-- CreateIndex
CREATE INDEX "Post_postType_idx" ON "Post"("postType");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Conversation_participantA_idx" ON "Conversation"("participantA");

-- CreateIndex
CREATE INDEX "Conversation_participantB_idx" ON "Conversation"("participantB");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_participantA_participantB_key" ON "Conversation"("participantA", "participantB");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_receiverId_read_idx" ON "Message"("receiverId", "read");

-- CreateIndex
CREATE INDEX "Review_reviewedId_idx" ON "Review"("reviewedId");

-- CreateIndex
CREATE INDEX "Brief_userId_idx" ON "Brief"("userId");

-- CreateIndex
CREATE INDEX "Brief_active_idx" ON "Brief"("active");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupProfile" ADD CONSTRAINT "StartupProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_participantA_fkey" FOREIGN KEY ("participantA") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_participantB_fkey" FOREIGN KEY ("participantB") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedId_fkey" FOREIGN KEY ("reviewedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
