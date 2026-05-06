/**
 * Database seed.
 *
 * Run with: `npm run seed`
 *
 * Idempotent via `upsert` / `findFirst → create-if-missing`. Safe to
 * re-run after schema changes — never deletes existing rows.
 *
 * Seeds:
 *   1. IndustrySimilarity lookup table used by matchmaking. Pairs are
 *      made symmetric (A↔B == B↔A).
 *   2. A demo Brief on Voltfang (the showcase startup) so the Hire-
 *      flow's "hiring for an existing job" picker has something to
 *      offer in production. Voltfang gets bumped to Pro to match
 *      (Briefs are a Pro-tier feature; Free users would need to
 *      upgrade to author one through the UI, but seed sidesteps
 *      that gate).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const VOLTFANG_EMAIL = "voltfang@seed.glimpse.app";
const VOLTFANG_BRIEF_TITLE =
  "Series-A launch film — Q3 product reveal";
const VOLTFANG_BRIEF_DESCRIPTION = `We're announcing our Series A in early Q3 — looking for a creator to shoot and edit a 60-second hero film for the product page + cutdowns for paid social.

Tone: confident, energetic, slightly cinematic. Think Linear's launch films, not corporate sizzle. Shot on location at our Berlin office + warehouse, ideally in golden-hour daylight.

Deliverables we'd want at hand-off:
- 1× 60-second hero, 16:9 (web)
- 1× 60-second hero, 9:16 (Instagram, TikTok)
- 3× 15-second cutdowns, 9:16
- Raw footage + project files (so we can iterate later)

We've got a rough storyboard and reference reel; happy to share once we connect. Open to your creative direction — the storyboard is a starting point, not a script.`;

const PAIRS: Array<[string, string, number]> = [
  ["outdoor_sport", "travel_adventure", 0.85],
  ["outdoor_sport", "lifestyle", 0.6],
  ["tech_saas", "fintech", 0.7],
  ["tech_saas", "fashion", 0.15],
  ["food_bev", "lifestyle", 0.65],
  ["sustainability", "outdoor_sport", 0.55],
  ["automotive", "tech_saas", 0.5],
  ["fashion", "lifestyle", 0.75],
  ["health", "lifestyle", 0.55],
  ["ecommerce", "fashion", 0.6],
  ["education", "tech_saas", 0.45],
  ["real_estate", "architecture", 0.8],
  ["manufacturing", "automotive", 0.6],
  ["manufacturing", "tech_saas", 0.4],
  ["luxury_lifestyle", "travel_adventure", 0.7],
  ["luxury_lifestyle", "fashion", 0.65],
  ["luxury_lifestyle", "automotive", 0.55],
  ["music_entertainment", "lifestyle", 0.6],
  ["music_entertainment", "fashion", 0.55],
  ["travel_adventure", "lifestyle", 0.65],
];

async function seedIndustrySimilarity() {
  // Forward direction
  for (const [a, b, score] of PAIRS) {
    await db.industrySimilarity.upsert({
      where: { industryA_industryB: { industryA: a, industryB: b } },
      update: { similarityScore: score },
      create: { industryA: a, industryB: b, similarityScore: score },
    });
  }
  // Symmetric reverse direction
  for (const [a, b, score] of PAIRS) {
    await db.industrySimilarity.upsert({
      where: { industryA_industryB: { industryA: b, industryB: a } },
      update: { similarityScore: score },
      create: { industryA: b, industryB: a, similarityScore: score },
    });
  }
  console.log(`Seeded ${PAIRS.length * 2} industry similarity rows.`);
}

async function seedVoltfangBrief() {
  const voltfang = await db.user.findUnique({
    where: { email: VOLTFANG_EMAIL },
    select: { id: true, membershipTier: true },
  });
  if (!voltfang) {
    console.log(
      `[seed] ${VOLTFANG_EMAIL} not found — skipping Voltfang brief seed`,
    );
    return;
  }

  // Bump tier to Pro so the /brief composer is reachable from the
  // UI for editing this seed brief later. No-op if already Pro.
  if (voltfang.membershipTier !== "pro") {
    await db.user.update({
      where: { id: voltfang.id },
      data: { membershipTier: "pro" },
    });
    console.log(`[seed] Upgraded ${VOLTFANG_EMAIL} to Pro`);
  }

  // Idempotent brief seed: find by (userId, title) — if it exists,
  // refresh the description in case we tweak the wording; if not,
  // create. Other (manually-authored) briefs on Voltfang stay
  // untouched.
  const existing = await db.brief.findFirst({
    where: { userId: voltfang.id, title: VOLTFANG_BRIEF_TITLE },
    select: { id: true },
  });
  if (existing) {
    await db.brief.update({
      where: { id: existing.id },
      data: { description: VOLTFANG_BRIEF_DESCRIPTION, active: true },
    });
    console.log(`[seed] Refreshed Voltfang brief (${existing.id})`);
  } else {
    // Mark any other active briefs inactive so the new one is the
    // single active brief — matches the /brief composer's
    // one-active-at-a-time invariant.
    await db.brief.updateMany({
      where: { userId: voltfang.id, active: true },
      data: { active: false },
    });
    const created = await db.brief.create({
      data: {
        userId: voltfang.id,
        title: VOLTFANG_BRIEF_TITLE,
        description: VOLTFANG_BRIEF_DESCRIPTION,
        active: true,
      },
    });
    console.log(`[seed] Created Voltfang brief (${created.id})`);
  }
}

async function main() {
  await seedIndustrySimilarity();
  await seedVoltfangBrief();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
