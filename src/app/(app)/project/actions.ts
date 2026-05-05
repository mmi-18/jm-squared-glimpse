"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const PAYOUT_DELAY_MS = UNDO_WINDOW_MS; // payout fires when undo window closes

/**
 * Project state-machine helpers. The schema's `status` enum is
 *   pending → active → delivered → completed
 *                                ↘ cancelled (from any non-final state)
 *
 * Each transition is gated to one role (client or creator) to keep the
 * intent of the action clear in code. Authorization and current-state
 * checks all live here — pages just render buttons.
 */

async function loadProjectAsParty(projectId: string, userId: string) {
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      OR: [{ clientId: userId }, { creatorId: userId }],
    },
  });
  if (!project) throw new Error("Project not found");
  return project;
}

/**
 * Creator: submit a delivery + flip status from `active` to `delivered`
 * in one transaction.
 *
 * Files come in pre-uploaded — the browser hits `/api/upload` per
 * file and gets back `{name, url, sizeBytes, contentType}` for each.
 * The action just persists the manifest + flips status. Letting the
 * server-side delivery action upload bytes too would mean buffering
 * potentially 50MB on the Next.js heap, which the 4GB Hetzner box
 * doesn't love.
 *
 * Validation: at least one of files/message must be non-empty —
 * delivering "nothing, with no note" is almost always a misclick.
 * Allowing empty strings lets us still mock zero-file deliveries
 * during dev (just type "test").
 */
export async function submitDelivery(args: {
  projectId: string;
  message?: string;
  files: Array<{
    name: string;
    url: string;
    sizeBytes: number;
    contentType: string;
  }>;
}) {
  const me = await requireUser();
  const project = await loadProjectAsParty(args.projectId, me.id);
  if (project.creatorId !== me.id) {
    throw new Error("Only the creator can submit a delivery");
  }
  if (project.status !== "active") {
    throw new Error(
      `Cannot submit delivery from status "${project.status}"`,
    );
  }

  const message = (args.message ?? "").trim();
  if (args.files.length === 0 && !message) {
    throw new Error("Add at least one file or a message");
  }

  // Sanity-check the file manifest. We don't re-verify the URLs
  // against the bucket here (extra round-trip per file, no win) —
  // the upload route is auth-gated so the URLs we get back came from
  // a signed-in session.
  for (const f of args.files) {
    if (!f.url || !f.name || typeof f.sizeBytes !== "number") {
      throw new Error("Invalid file manifest");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.delivery.create({
      data: {
        projectId: project.id,
        message: message || null,
        files: args.files,
      },
    });
    await tx.project.update({
      where: { id: project.id },
      data: { status: "delivered" },
    });
  });

  revalidatePath(`/project/${args.projectId}`);
  revalidatePath("/projects");
  return { ok: true };
}

/**
 * Backwards-compat shim — older callers (tests / dev tools) still
 * import `markDelivered`. Forwards to `submitDelivery` with an empty
 * file manifest + a placeholder message so the new validation passes.
 *
 * Direct UI callers should use `submitDelivery` so the user gets a
 * real upload affordance instead of a one-click status flip.
 */
export async function markDelivered(projectId: string) {
  return submitDelivery({
    projectId,
    files: [],
    message: "(no files attached)",
  });
}

/**
 * Client: sign off and complete the project. Status must be `delivered`.
 * Sets `signedOffAt = now()` — the 24-hour undo window + the eventual
 * 14-day stale-review release (Chunk A4) both read off this timestamp.
 *
 * Chunk F-prep: also sets `payoutScheduledFor = signedOffAt + 24h`,
 * which the daily cron uses to fire the (mock) payout once the undo
 * window closes. Decoupling intent (sign-off) from money movement
 * (payout) means buyer's-remorse undo doesn't have to claw back a
 * Stripe transfer.
 */
export async function signOffProject(projectId: string) {
  const me = await requireUser();
  const project = await loadProjectAsParty(projectId, me.id);
  if (project.clientId !== me.id) {
    throw new Error("Only the client can sign off a project");
  }
  if (project.status !== "delivered") {
    throw new Error(`Cannot sign off from status "${project.status}"`);
  }

  const now = new Date();
  const payoutAt = new Date(now.getTime() + PAYOUT_DELAY_MS);

  await db.project.update({
    where: { id: projectId },
    data: {
      status: "completed",
      signedOffAt: now,
      payoutScheduledFor: payoutAt,
    },
  });

  revalidatePath(`/project/${projectId}`);
  return { ok: true };
}

/**
 * Client: undo a sign-off, only within 24 hours of signing.
 * Reverts status to `delivered` so creator can iterate or client can
 * just re-sign once they've thought about it.
 */
export async function undoSignOff(projectId: string) {
  const me = await requireUser();
  const project = await loadProjectAsParty(projectId, me.id);
  if (project.clientId !== me.id) {
    throw new Error("Only the client can undo sign-off");
  }
  if (project.status !== "completed" || !project.signedOffAt) {
    throw new Error("Project is not currently signed off");
  }
  const elapsed = Date.now() - project.signedOffAt.getTime();
  if (elapsed > UNDO_WINDOW_MS) {
    throw new Error("The 24-hour undo window has expired");
  }

  await db.project.update({
    where: { id: projectId },
    data: {
      status: "delivered",
      signedOffAt: null,
      // Cancel the scheduled payout — back to "delivered, awaiting
      // approval." Re-signing later will re-schedule it.
      payoutScheduledFor: null,
    },
  });

  revalidatePath(`/project/${projectId}`);
  return { ok: true };
}

/**
 * Either party: submit their review on a completed project.
 *
 * Two-way blind logic: each side's row is stored with `released=false`.
 * Once both sides have submitted, BOTH rows flip to `released=true` in
 * the same transaction. Pre-existing seed reviews have `projectId=null`
 * and `released=true` by default — they're untouched.
 *
 * If the counterparty submitted >14 days ago and is still waiting on
 * us, the cron in Chunk A4 will have already released theirs unilaterally.
 * This action also checks that case for safety: if a counterparty review
 * exists already, we release both regardless of timing.
 */
export async function submitReview(args: {
  projectId: string;
  ratingOverall: number;
  ratingReliability: number;
  ratingQuality: number;
  ratingCollaboration: number;
  text?: string | null;
}) {
  const me = await requireUser();
  const project = await loadProjectAsParty(args.projectId, me.id);

  if (project.status !== "completed") {
    throw new Error("Reviews can only be submitted on completed projects");
  }
  if (!project.signedOffAt) {
    throw new Error("Project must be signed off before reviewing");
  }

  // Range-check ratings (1-5).
  for (const r of [
    args.ratingOverall,
    args.ratingReliability,
    args.ratingQuality,
    args.ratingCollaboration,
  ]) {
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      throw new Error("Each rating must be an integer between 1 and 5");
    }
  }

  // Already reviewed?
  const existing = await db.review.findFirst({
    where: { projectId: args.projectId, reviewerId: me.id },
    select: { id: true },
  });
  if (existing) {
    throw new Error("You've already submitted a review for this project");
  }

  const isClient = me.id === project.clientId;
  const direction = isClient ? "client_to_creator" : "creator_to_client";
  const reviewedId = isClient ? project.creatorId : project.clientId;
  const text = (args.text ?? "").trim() || null;

  await db.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        reviewerId: me.id,
        reviewedId,
        projectId: args.projectId,
        direction,
        released: false,
        ratingOverall: args.ratingOverall,
        ratingReliability: args.ratingReliability,
        ratingQuality: args.ratingQuality,
        ratingCollaboration: args.ratingCollaboration,
        reviewText: text,
      },
    });

    // Check if the OTHER direction already exists for this project.
    // If yes → flip both released=true. Two-way blind reveal.
    const both = await tx.review.findMany({
      where: { projectId: args.projectId },
      select: { direction: true },
    });
    const hasClient = both.some((r) => r.direction === "client_to_creator");
    const hasCreator = both.some((r) => r.direction === "creator_to_client");
    if (hasClient && hasCreator) {
      await tx.review.updateMany({
        where: { projectId: args.projectId, released: false },
        data: { released: true },
      });
    }
  });

  // Revalidate every surface that shows reviews
  revalidatePath(`/project/${args.projectId}`);
  revalidatePath(`/creator/${reviewedId}`);
  revalidatePath(`/startup/${reviewedId}`);
  revalidatePath(`/creator/${me.id}`);
  revalidatePath(`/startup/${me.id}`);
  return { ok: true };
}

/**
 * Either party: cancel a non-final project. Status flows to `cancelled`
 * with `cancelledAt = now()`. Cannot be reversed.
 *
 * Chunk F-prep refund handling: if the project was already paid, the
 * deposit is refunded (mock — sets `paidAt = null`). When Chunk
 * F-stripe lands, this becomes a real `stripe.refunds.create(...)`
 * call. Any pending payout is also cancelled.
 *
 * Edge case to watch: cancelling AFTER the creator delivered means
 * the creator did the work but won't get paid. For v1 we accept that
 * risk — both parties have to agree to cancel implicitly (either
 * could refuse to mark delivered or refuse to sign off). Adding
 * arbitration / partial refunds is a Chunk-G concern.
 */
export async function cancelProject(projectId: string) {
  const me = await requireUser();
  const project = await loadProjectAsParty(projectId, me.id);
  if (project.status === "completed" || project.status === "cancelled") {
    throw new Error("Cannot cancel a finalised project");
  }

  await db.project.update({
    where: { id: projectId },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      // Mock refund: clear the payment. When Stripe is wired up
      // (Chunk F-stripe), call stripe.refunds.create here too.
      paidAt: null,
      // Cancel any pending payout in flight.
      payoutScheduledFor: null,
    },
  });

  revalidatePath(`/project/${projectId}`);
  revalidatePath("/projects");
  return { ok: true };
}
