/**
 * Playwright global teardown — runs once after the smoke suite completes,
 * regardless of whether tests passed or failed.
 *
 * Deletes any User row whose email starts with `pw-smoke-`. The cascade
 * from User → Session/Account/CreatorProfile/StartupProfile/Post/etc.
 * picks up the rest, so this single deleteMany is enough.
 *
 * Idempotent + bulletproof: if a previous run failed mid-test and left
 * orphan rows, the next run's teardown picks them up too.
 */
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

export default async function globalTeardown() {
  const db = new PrismaClient();
  try {
    const before = await db.user.count({
      where: { email: { startsWith: "pw-smoke-" } },
    });

    if (before === 0) {
      console.log("[smoke teardown] No test users found — nothing to clean up.");
      return;
    }

    const result = await db.user.deleteMany({
      where: { email: { startsWith: "pw-smoke-" } },
    });
    console.log(
      `[smoke teardown] Deleted ${result.count} test user${result.count === 1 ? "" : "s"} (matched: ${before}).`,
    );
  } catch (err) {
    // Don't fail the whole run on cleanup failure — just yell loudly so
    // the next run picks it up.
    console.error("[smoke teardown] Cleanup failed:", err);
  } finally {
    await db.$disconnect();
  }
}
