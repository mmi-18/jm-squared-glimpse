import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Daily cron: release reviews that have been waiting >14 days for the
 * counterparty's review. Without this, a non-responding party can hold
 * the other's reputation hostage indefinitely.
 *
 * Hit it daily from any cron source (GitHub Actions schedule, Hetzner
 * crontab, Cloudflare Worker, etc.) with:
 *
 *   POST /api/cron/release-stale-reviews
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Idempotent — re-running within the same day finds nothing new and
 * no-ops. Returns {released: <count>, projectIds: [...]} so the cron
 * runner can log activity.
 *
 * Deliberately NOT touching reviews where the counterparty has also
 * submitted — those flip to released=true atomically inside the
 * submitReview action, so they should already be released by the time
 * this cron runs. We only catch the orphans.
 */

const STALE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on the server" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_WINDOW_MS);

  const stale = await db.review.findMany({
    where: {
      released: false,
      createdAt: { lt: cutoff },
    },
    select: { id: true, projectId: true, reviewedId: true, reviewerId: true },
  });

  if (stale.length === 0) {
    return NextResponse.json({
      released: 0,
      message: "No stale reviews — nothing to release",
    });
  }

  await db.review.updateMany({
    where: { id: { in: stale.map((r) => r.id) } },
    data: { released: true },
  });

  return NextResponse.json({
    released: stale.length,
    projectIds: Array.from(
      new Set(stale.map((r) => r.projectId).filter(Boolean)),
    ),
    timestamp: new Date().toISOString(),
  });
}
