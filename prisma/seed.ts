/**
 * Database seed.
 *
 * Run with: `npm run seed`
 *
 * Seeds the IndustrySimilarity lookup table used by matchmaking. Idempotent
 * via `upsert` — safe to re-run after schema changes.
 *
 * Pairs are made symmetric (A↔B == B↔A) so the matchmaker can look up
 * either direction without an OR-clause.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

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

async function main() {
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

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
