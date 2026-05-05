import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Daily cron — three jobs in one endpoint.
 *
 * The route URL keeps the original Chunk-A name (`release-stale-reviews`)
 * for backward compatibility with `.github/workflows/cron-release-reviews.yml`,
 * but the handler now also runs the Chunk-F-prep payout release and
 * the auto-acceptance sweep. They share the auth + transactional
 * idempotency story, so it's cheaper to run them together than to
 * spin up three separate cron entries.
 *
 * Hit it daily from any cron source (GitHub Actions schedule, Hetzner
 * crontab, Cloudflare Worker, etc.) with:
 *
 *   POST /api/cron/release-stale-reviews
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Idempotent — re-running within the same day finds nothing new and
 * no-ops. Returns a per-job summary so the cron runner can log
 * activity and we can sanity-check production behaviour from the
 * GitHub Actions log.
 */

const STALE_REVIEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const AUTO_ACCEPT_DELIVERY_MS = 14 * 24 * 60 * 60 * 1000;
const PAYOUT_DELAY_MS = 24 * 60 * 60 * 1000; // matches signOffProject

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

  const now = new Date();

  // ─── Job 1: release stale reviews ────────────────────────────────────
  // (Original Chunk-A4 behaviour — unchanged.)
  const reviewCutoff = new Date(now.getTime() - STALE_REVIEW_WINDOW_MS);
  const staleReviews = await db.review.findMany({
    where: { released: false, createdAt: { lt: reviewCutoff } },
    select: { id: true, projectId: true },
  });
  if (staleReviews.length > 0) {
    await db.review.updateMany({
      where: { id: { in: staleReviews.map((r) => r.id) } },
      data: { released: true },
    });
  }

  // ─── Job 2: auto-accept stale deliveries (Chunk F-prep) ──────────────
  //
  // A creator delivers, the client never signs off → without
  // intervention the creator's money is stuck in escrow forever. We
  // auto-flip those to `completed` after 14 days in `delivered`,
  // scheduling the payout for 24h later (same as a manual sign-off).
  // The (would-be) signedOffAt is set to now() so the timeline
  // metadata still reads cleanly.
  //
  // We use `updatedAt` as the proxy for "how long has this sat in
  // delivered" — `markDelivered` updates it, and any subsequent
  // tweaks would push it forward, which is fine: we want the most
  // recent client-relevant change to start the clock.
  const deliveryCutoff = new Date(now.getTime() - AUTO_ACCEPT_DELIVERY_MS);
  const stuckDeliveries = await db.project.findMany({
    where: {
      status: "delivered",
      updatedAt: { lt: deliveryCutoff },
    },
    select: { id: true },
  });
  if (stuckDeliveries.length > 0) {
    const payoutAt = new Date(now.getTime() + PAYOUT_DELAY_MS);
    await db.project.updateMany({
      where: { id: { in: stuckDeliveries.map((p) => p.id) } },
      data: {
        status: "completed",
        signedOffAt: now,
        payoutScheduledFor: payoutAt,
      },
    });
  }

  // ─── Job 3: release scheduled payouts (Chunk F-prep) ─────────────────
  //
  // Anything where the 24-hour undo window has expired and we
  // haven't already paid out. In Chunk F-prep this is just a flag
  // flip (`payoutReleasedAt = now()`); when Chunk F-stripe lands
  // we add `await stripe.transfers.create(...)` here per project,
  // catch the result, and only set the timestamp if the transfer
  // succeeded.
  const duePayouts = await db.project.findMany({
    where: {
      status: "completed",
      payoutReleasedAt: null,
      payoutScheduledFor: { lte: now, not: null },
    },
    select: { id: true },
  });
  if (duePayouts.length > 0) {
    await db.project.updateMany({
      where: { id: { in: duePayouts.map((p) => p.id) } },
      data: { payoutReleasedAt: now },
    });
  }

  return NextResponse.json({
    timestamp: now.toISOString(),
    reviewsReleased: staleReviews.length,
    deliveriesAutoAccepted: stuckDeliveries.length,
    payoutsReleased: duePayouts.length,
  });
}
