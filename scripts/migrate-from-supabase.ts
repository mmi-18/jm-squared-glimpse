/**
 * One-shot Supabase → Neon (via Prisma + BetterAuth) data migration.
 *
 * Source:    https://kyvfiihydffryedrftcs.supabase.co  (project "Glimpse")
 * Target:    Neon main branch — whatever DATABASE_URL points at when run.
 *
 * Run with:
 *   npx tsx scripts/migrate-from-supabase.ts
 *
 * Required env (live in .env on Mario's laptop, not committed):
 *   - SUPABASE_URL                  https://kyvfiihydffryedrftcs.supabase.co
 *   - SUPABASE_SERVICE_KEY          sb_secret_… (full Supabase admin key)
 *   - DATABASE_URL / DIRECT_URL     Neon connection strings (already set
 *                                   for the rest of the app)
 *
 * What this does:
 *   1. Pulls every row from auth.users + the 7 domain tables in Supabase.
 *   2. Hashes the password "glimpse-seed-2026" once via BetterAuth's
 *      scrypt and writes that into every Account row, so you can sign in
 *      as any of the 22 migrated users with that one password.
 *   3. Inserts into Neon via Prisma using the Supabase UUIDs as primary
 *      keys (so foreign-key relationships don't need rewriting).
 *   4. Idempotent via upsert — safe to re-run after schema changes.
 *
 * Skipped on purpose:
 *   - public.industry_similarity   already seeded by prisma/seed.ts
 *   - public.briefs                empty in source
 *   - bcrypt password hashes from auth.users — Supabase uses bcrypt,
 *     BetterAuth uses scrypt. Forcing one shared password for all
 *     migrated accounts is the simplest path; users can change theirs
 *     in-app later.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const SHARED_PASSWORD = "glimpse-seed-2026";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars. See header comment.",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = new PrismaClient();

// ─── helpers ────────────────────────────────────────────────────────────────

async function fetchAll<T extends Record<string, unknown>>(
  table: string,
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw new Error(`Supabase fetch ${table} failed: ${error.message}`);
  return (data ?? []) as T[];
}

const toDate = (v: unknown): Date | null =>
  typeof v === "string" || v instanceof Date ? new Date(v as string) : null;
const toDateOrUndef = (v: unknown): Date | undefined =>
  v == null ? undefined : new Date(v as string);

// Prisma enum names can't start with a digit, so the schema uses
// `@map("1_3_days")` etc. for the Turnaround enum — the DB column stores
// "1_3_days" but the Prisma client API expects the TS name "days_1_3".
// All other enums in the schema use values verbatim (no @map needed).
const TURNAROUND_DB_TO_TS: Record<
  string,
  "days_1_3" | "week_1" | "weeks_2" | "month_1" | "flexible"
> = {
  "1_3_days": "days_1_3",
  "1_week": "week_1",
  "2_weeks": "weeks_2",
  "1_month": "month_1",
  flexible: "flexible",
};
const mapTurnaround = (v: unknown) =>
  v == null ? null : (TURNAROUND_DB_TO_TS[v as string] ?? null);

// ─── auth admin: pull every auth.users row for emails ───────────────────────

async function fetchAuthUsers(): Promise<Map<string, string>> {
  // listUsers paginates 1000 at a time; we only have ~22, single page.
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw new Error(`auth.admin.listUsers failed: ${error.message}`);
  const m = new Map<string, string>();
  for (const u of data.users) {
    if (u.email) m.set(u.id, u.email);
  }
  return m;
}

// ─── main migration ────────────────────────────────────────────────────────

async function main() {
  console.log(`→ Hashing shared password "${SHARED_PASSWORD}"...`);
  const passwordHash = await hashPassword(SHARED_PASSWORD);

  console.log("→ Pulling auth.users (for emails)...");
  const authEmails = await fetchAuthUsers();
  console.log(`  ${authEmails.size} auth users`);

  console.log("→ Pulling public domain tables...");
  type SbUser = {
    id: string;
    email: string;
    user_type: "creator" | "startup";
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    location_city: string | null;
    location_country: string | null;
    languages: string[] | null;
    cultural_markets: string[] | null;
    onboarding_completed: boolean;
    membership_tier: "free" | "pro";
    created_at: string;
  };
  const users = await fetchAll<SbUser>("users");
  console.log(`  users: ${users.length}`);

  type SbCreatorProfile = Record<string, unknown> & { user_id: string };
  const creatorProfiles = await fetchAll<SbCreatorProfile>("creator_profiles");
  console.log(`  creator_profiles: ${creatorProfiles.length}`);

  type SbStartupProfile = Record<string, unknown> & { user_id: string };
  const startupProfiles = await fetchAll<SbStartupProfile>("startup_profiles");
  console.log(`  startup_profiles: ${startupProfiles.length}`);

  type SbPost = Record<string, unknown> & { id: string; user_id: string };
  const posts = await fetchAll<SbPost>("posts");
  console.log(`  posts: ${posts.length}`);

  type SbConversation = Record<string, unknown> & { id: string };
  const conversations = await fetchAll<SbConversation>("conversations");
  console.log(`  conversations: ${conversations.length}`);

  type SbMessage = Record<string, unknown> & { id: string };
  const messages = await fetchAll<SbMessage>("messages");
  console.log(`  messages: ${messages.length}`);

  type SbReview = Record<string, unknown> & { id: string };
  const reviews = await fetchAll<SbReview>("reviews");
  console.log(`  reviews: ${reviews.length}`);

  // ─── 1. Users (and their BetterAuth Account rows) ────────────────────────
  console.log("\n→ Migrating users + accounts...");
  let userOk = 0;
  for (const u of users) {
    const email = u.email || authEmails.get(u.id);
    if (!email) {
      console.warn(`  skipping ${u.id}: no email`);
      continue;
    }

    await db.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        email,
        emailVerified: true, // they were verified in Supabase — preserve trust
        name: u.display_name,
        image: u.avatar_url,
        userType: u.user_type,
        bio: u.bio,
        locationCity: u.location_city,
        locationCountry: u.location_country,
        languages: u.languages ?? [],
        culturalMarkets: u.cultural_markets ?? [],
        onboardingCompleted: u.onboarding_completed,
        membershipTier: u.membership_tier,
        createdAt: toDate(u.created_at) ?? new Date(),
        updatedAt: new Date(),
      },
      update: {
        email,
        name: u.display_name,
        image: u.avatar_url,
        userType: u.user_type,
        bio: u.bio,
        locationCity: u.location_city,
        locationCountry: u.location_country,
        languages: u.languages ?? [],
        culturalMarkets: u.cultural_markets ?? [],
        onboardingCompleted: u.onboarding_completed,
        membershipTier: u.membership_tier,
      },
    });

    // BetterAuth's "credential" provider Account: providerId="credential",
    // accountId=email, password=scrypt-hashed. The id is a stable derived
    // string so re-runs upsert cleanly.
    const accountId = `${u.id}-credential`;
    await db.account.upsert({
      where: { id: accountId },
      create: {
        id: accountId,
        userId: u.id,
        accountId: email,
        providerId: "credential",
        password: passwordHash,
        createdAt: toDate(u.created_at) ?? new Date(),
        updatedAt: new Date(),
      },
      update: {
        accountId: email,
        password: passwordHash,
      },
    });
    userOk++;
  }
  console.log(`  ${userOk} users + accounts migrated`);

  // ─── 2. Creator profiles ─────────────────────────────────────────────────
  console.log("→ Migrating creator profiles...");
  let cpOk = 0;
  for (const p of creatorProfiles) {
    const data = {
      userId: p.user_id as string,
      discipline: (p.discipline ?? null) as
        | "video"
        | "photo"
        | "both"
        | null,
      contentCategories: (p.content_categories as string[]) ?? [],
      contentStyleTags: (p.content_style_tags as string[]) ?? [],
      deliverableTypes: (p.deliverable_types as string[]) ?? [],
      rateMin: (p.rate_min as number | null) ?? null,
      rateMax: (p.rate_max as number | null) ?? null,
      availability: (p.availability as
        | "immediately"
        | "within_1_week"
        | "within_1_month"
        | "limited"
        | null) ?? null,
      portfolioUrls: (p.portfolio_urls as string[]) ?? [],
      subSpecializations: (p.sub_specializations as string[]) ?? [],
      industryExperience: (p.industry_experience as string[]) ?? [],
      minimumAcceptableBudget:
        (p.minimum_acceptable_budget as number | null) ?? null,
      typicalTurnaround: mapTurnaround(p.typical_turnaround),
      travelWillingness:
        (p.travel_willingness as
          | "local_only"
          | "regional"
          | "national"
          | "international"
          | "worldwide"
          | null) ?? null,
      preferredProjectTypes: (p.preferred_project_types as string[]) ?? [],
      unwantedWorkTypes: (p.unwanted_work_types as string[]) ?? [],
      usageLicensingPreference:
        (p.usage_licensing_preference as
          | "full_buyout"
          | "limited_usage"
          | "negotiable"
          | null) ?? null,
      productionCapabilities: (p.production_capabilities as string[]) ?? [],
      socialHandles: (p.social_handles as object) ?? {},
      creativeDiscipline:
        (p.creative_discipline as
          | "videographer"
          | "photographer"
          | "both"
          | "motion_designer"
          | null) ?? null,
      equipment: (p.equipment as string[]) ?? [],
      audienceSize: (p.audience_size as number | null) ?? null,
      pastBrandCollaborations:
        (p.past_brand_collaborations as string | null) ?? null,
      creativePhilosophy: (p.creative_philosophy as string | null) ?? null,
      inspirationCreators: (p.inspiration_creators as string[]) ?? [],
      showreelUrl: (p.showreel_url as string | null) ?? null,
      styleProductionValue:
        (p.style_production_value as number | null) ?? null,
      stylePacing: (p.style_pacing as number | null) ?? null,
      styleFocus: (p.style_focus as number | null) ?? null,
      styleFraming: (p.style_framing as number | null) ?? null,
      styleStaging: (p.style_staging as number | null) ?? null,
      styleColor: (p.style_color as number | null) ?? null,
      styleSound: (p.style_sound as number | null) ?? null,
      avgRating: (p.avg_rating as number | null) ?? null,
      reviewCount: (p.review_count as number) ?? 0,
      portfolioLayout: (p.portfolio_layout as object | null) ?? null,
      aboutLayout: (p.about_layout as object | null) ?? null,
    };
    await db.creatorProfile.upsert({
      where: { userId: data.userId },
      create: data,
      update: data,
    });
    cpOk++;
  }
  console.log(`  ${cpOk} creator profiles migrated`);

  // ─── 3. Startup profiles ─────────────────────────────────────────────────
  console.log("→ Migrating startup profiles...");
  let spOk = 0;
  for (const p of startupProfiles) {
    const data = {
      userId: p.user_id as string,
      companyName: (p.company_name as string | null) ?? null,
      industry: (p.industry as string | null) ?? null,
      locationMarket: (p.location_market as string[]) ?? [],
      contactPerson: (p.contact_person as string | null) ?? null,
      contactRole: (p.contact_role as string | null) ?? null,
      contactEmail: (p.contact_email as string | null) ?? null,
      typicalBudgetRangeMin:
        (p.typical_budget_range_min as number | null) ?? null,
      typicalBudgetRangeMax:
        (p.typical_budget_range_max as number | null) ?? null,
      projectGoal: (p.project_goal as string[]) ?? [],
      desiredLookFeeling: (p.desired_look_feeling as string[]) ?? [],
      deliverablesNeeded: (p.deliverables_needed as string[]) ?? [],
      quantityVolume: (p.quantity_volume as number | null) ?? null,
      deadline: toDateOrUndef(p.deadline) ?? null,
      budgetForProject: (p.budget_for_project as number | null) ?? null,
      contentUsagePlatforms: (p.content_usage_platforms as string[]) ?? [],
      companyStage:
        (p.company_stage as
          | "pre_seed"
          | "seed"
          | "series_a"
          | "series_b_plus"
          | "established"
          | null) ?? null,
      websiteUrl: (p.website_url as string | null) ?? null,
      companyDescription: (p.company_description as string | null) ?? null,
      contentCategoriesHired: (p.content_categories_hired as string[]) ?? [],
      brandLookGuidelines:
        (p.brand_look_guidelines as
          | "strict_brand_guide"
          | "loose_guidelines"
          | "no_guidelines"
          | "open_to_suggestions"
          | null) ?? null,
      language: (p.language as string[]) ?? [],
      targetAudience: (p.target_audience as string[]) ?? [],
      qualitiesInCreator: (p.qualities_in_creator as string[]) ?? [],
      contentCommunicationGoal:
        (p.content_communication_goal as string[]) ?? [],
      successCriteria: (p.success_criteria as string | null) ?? null,
      usageRightsScope:
        (p.usage_rights_scope as
          | "full_buyout"
          | "limited_platform"
          | "time_limited"
          | "negotiable"
          | null) ?? null,
      locationProductionConstraints:
        (p.location_production_constraints as string[]) ?? [],
      equipmentNeeded: (p.equipment_needed as string[]) ?? [],
      brandValues: (p.brand_values as string[]) ?? [],
      pastCreatorCollaborations:
        (p.past_creator_collaborations as string | null) ?? null,
      typicalTimelinePattern:
        (p.typical_timeline_pattern as
          | "urgent_1_week"
          | "standard_2_4_weeks"
          | "flexible"
          | "ongoing"
          | null) ?? null,
      brandGuidelinesUrl: (p.brand_guidelines_url as string | null) ?? null,
      referenceContentUrls: (p.reference_content_urls as string[]) ?? [],
      brandDescription: (p.brand_description as string | null) ?? null,
      styleProductionValue:
        (p.style_production_value as number | null) ?? null,
      stylePacing: (p.style_pacing as number | null) ?? null,
      styleFocus: (p.style_focus as number | null) ?? null,
      styleFraming: (p.style_framing as number | null) ?? null,
      styleStaging: (p.style_staging as number | null) ?? null,
      styleColor: (p.style_color as number | null) ?? null,
      styleSound: (p.style_sound as number | null) ?? null,
    };
    await db.startupProfile.upsert({
      where: { userId: data.userId },
      create: data,
      update: data,
    });
    spOk++;
  }
  console.log(`  ${spOk} startup profiles migrated`);

  // ─── 4. Posts ────────────────────────────────────────────────────────────
  console.log("→ Migrating posts...");
  let postOk = 0;
  for (const p of posts) {
    const data = {
      id: p.id as string,
      userId: p.user_id as string,
      postType: (p.post_type as "portfolio_piece" | "job_listing"),
      title: (p.title as string | null) ?? null,
      description: (p.description as string | null) ?? null,
      mediaUrls: (p.media_urls as string[]) ?? [],
      thumbnailUrl: (p.thumbnail_url as string | null) ?? null,
      contentType: (p.content_type as string | null) ?? null,
      industry: (p.industry as string | null) ?? null,
      format:
        (p.format as "vertical" | "horizontal" | "square" | null) ?? null,
      durationSeconds: (p.duration_seconds as number | null) ?? null,
      equipmentUsed: (p.equipment_used as string[]) ?? [],
      styleProductionValue:
        (p.style_production_value as number | null) ?? null,
      stylePacing: (p.style_pacing as number | null) ?? null,
      styleFocus: (p.style_focus as number | null) ?? null,
      styleFraming: (p.style_framing as number | null) ?? null,
      styleStaging: (p.style_staging as number | null) ?? null,
      styleColor: (p.style_color as number | null) ?? null,
      styleSound: (p.style_sound as number | null) ?? null,
      likesCount: (p.likes_count as number) ?? 0,
      viewsCount: (p.views_count as number) ?? 0,
      cellLayout: (p.cell_layout as object | null) ?? null,
      previewLayout: (p.preview_layout as object | null) ?? null,
      createdAt: toDate(p.created_at) ?? new Date(),
    };
    await db.post.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
    postOk++;
  }
  console.log(`  ${postOk} posts migrated`);

  // ─── 5. Conversations ────────────────────────────────────────────────────
  console.log("→ Migrating conversations...");
  let convOk = 0;
  for (const c of conversations) {
    const data = {
      id: c.id as string,
      participantA: c.participant_a as string,
      participantB: c.participant_b as string,
      matchScore: (c.match_score as number | null) ?? null,
      lastMessageAt: toDateOrUndef(c.last_message_at) ?? null,
      createdAt: toDate(c.created_at) ?? new Date(),
    };
    await db.conversation.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
    convOk++;
  }
  console.log(`  ${convOk} conversations migrated`);

  // ─── 6. Messages ─────────────────────────────────────────────────────────
  console.log("→ Migrating messages...");
  let msgOk = 0;
  for (const m of messages) {
    const data = {
      id: m.id as string,
      conversationId: (m.conversation_id as string | null) ?? null,
      senderId: m.sender_id as string,
      receiverId: m.receiver_id as string,
      content: m.content as string,
      read: (m.read as boolean) ?? false,
      matchScore: (m.match_score as number | null) ?? null,
      createdAt: toDate(m.created_at) ?? new Date(),
    };
    await db.message.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
    msgOk++;
  }
  console.log(`  ${msgOk} messages migrated`);

  // ─── 7. Reviews ──────────────────────────────────────────────────────────
  console.log("→ Migrating reviews...");
  let revOk = 0;
  for (const r of reviews) {
    const data = {
      id: r.id as string,
      reviewerId: r.reviewer_id as string,
      reviewedId: r.reviewed_id as string,
      projectDescription: (r.project_description as string | null) ?? null,
      ratingOverall: (r.rating_overall as number | null) ?? null,
      ratingReliability: (r.rating_reliability as number | null) ?? null,
      ratingQuality: (r.rating_quality as number | null) ?? null,
      ratingCollaboration: (r.rating_collaboration as number | null) ?? null,
      reviewText: (r.review_text as string | null) ?? null,
      createdAt: toDate(r.created_at) ?? new Date(),
    };
    await db.review.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
    revOk++;
  }
  console.log(`  ${revOk} reviews migrated`);

  // ─── Summary ─────────────────────────────────────────────────────────────
  const counts = {
    users: await db.user.count(),
    accounts: await db.account.count(),
    creatorProfiles: await db.creatorProfile.count(),
    startupProfiles: await db.startupProfile.count(),
    posts: await db.post.count(),
    conversations: await db.conversation.count(),
    messages: await db.message.count(),
    reviews: await db.review.count(),
    industrySimilarity: await db.industrySimilarity.count(),
  };
  console.log("\n─── Neon row counts after migration ───");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  console.log(
    `\nAll migrated users can sign in with the password: ${SHARED_PASSWORD}`,
  );
}

main()
  .catch((err) => {
    console.error("MIGRATION FAILED:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
