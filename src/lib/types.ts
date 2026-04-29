/**
 * Shared types — re-exports of Prisma-generated model types under
 * stable names so the rest of the app doesn't have to import from
 * `@prisma/client` everywhere, plus a couple of UI-only helpers.
 *
 * Migration note (Apr 2026): when the app moved from Supabase to Prisma+Neon
 * the field naming convention changed from snake_case to camelCase. Old
 * imports like `UserRow` / `PostRow` / `BriefRow` continue to work as
 * aliases of the Prisma types, but the *fields* are camelCase now
 * (`userType`, `mediaUrls`, `referenceImageUrls`, etc.).
 */

export type {
  User,
  Session,
  Account,
  Verification,
  CreatorProfile,
  StartupProfile,
  Post,
  Conversation,
  Message,
  Review,
  Brief,
  IndustrySimilarity,
} from "@prisma/client";

export {
  UserType,
  MembershipTier,
  Discipline,
  CreativeDiscipline,
  Availability,
  Turnaround,
  Travel,
  Licensing,
  CompanyStage,
  BrandGuidelines,
  UsageRights,
  TimelinePattern,
  PostType,
  Format,
} from "@prisma/client";

import type {
  User as PrismaUser,
  Brief as PrismaBrief,
  Post as PrismaPost,
  Conversation as PrismaConversation,
  Message as PrismaMessage,
  Review as PrismaReview,
  IndustrySimilarity as PrismaIndustrySimilarity,
} from "@prisma/client";

// Backward-compat aliases so call sites that imported `UserRow` etc. from
// the old Supabase-era types.ts keep compiling. Prefer the canonical
// names (`User`, `Post`, …) in new code.
export type UserRow = PrismaUser;
export type BriefRow = PrismaBrief;
export type PostRow = PrismaPost;
export type ConversationRow = PrismaConversation;
export type MessageRow = PrismaMessage;
export type ReviewRow = PrismaReview;
export type IndustrySimilarityRow = PrismaIndustrySimilarity;

/**
 * The 7 style dimensions, 1–10, nullable. Used both on creator profiles
 * (the creator's average style) and on individual posts (the style of
 * that piece). Range enforcement happens in the app — the DB stores Int.
 */
export type StyleVector = {
  styleProductionValue: number | null;
  stylePacing: number | null;
  styleFocus: number | null;
  styleFraming: number | null;
  styleStaging: number | null;
  styleColor: number | null;
  styleSound: number | null;
};
