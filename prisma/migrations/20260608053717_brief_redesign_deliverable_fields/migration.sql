-- CreateEnum
CREATE TYPE "DeliverableMedium" AS ENUM ('photo', 'video', 'to_be_determined');

-- CreateEnum
CREATE TYPE "DeliverablePlatform" AS ENUM ('instagram', 'tiktok', 'youtube', 'linkedin', 'website', 'event', 'cinema', 'internal', 'to_be_determined');

-- CreateEnum
CREATE TYPE "DurationBucket" AS ENUM ('under_15s', 'from_15_to_30s', 'from_30_to_60s', 'from_1_to_3_min', 'over_3_min', 'not_applicable');

-- AlterTable
ALTER TABLE "Brief" ADD COLUMN     "deliverableCountMax" INTEGER,
ADD COLUMN     "deliverableCountMin" INTEGER,
ADD COLUMN     "deliverableDuration" "DurationBucket",
ADD COLUMN     "deliverableMedium" "DeliverableMedium",
ADD COLUMN     "deliverablePlatforms" "DeliverablePlatform"[] DEFAULT ARRAY[]::"DeliverablePlatform"[];
