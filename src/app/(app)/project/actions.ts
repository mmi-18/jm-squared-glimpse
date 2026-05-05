"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

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
 * Creator: mark a project as delivered. Status must be `active`.
 *
 * In Chunk B (file uploads) this becomes "submit a delivery"; for now
 * it's a single status flip with no attached files.
 */
export async function markDelivered(projectId: string) {
  const me = await requireUser();
  const project = await loadProjectAsParty(projectId, me.id);
  if (project.creatorId !== me.id) {
    throw new Error("Only the creator can mark a project delivered");
  }
  if (project.status !== "active") {
    throw new Error(
      `Cannot mark delivered from status "${project.status}"`,
    );
  }

  await db.project.update({
    where: { id: projectId },
    data: { status: "delivered" },
  });

  revalidatePath(`/project/${projectId}`);
  return { ok: true };
}

/**
 * Client: sign off and complete the project. Status must be `delivered`.
 * Sets `signedOffAt = now()` — the 24-hour undo window + the eventual
 * 14-day stale-review release (Chunk A4) both read off this timestamp.
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

  await db.project.update({
    where: { id: projectId },
    data: { status: "completed", signedOffAt: new Date() },
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
    data: { status: "delivered", signedOffAt: null },
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
 */
export async function cancelProject(projectId: string) {
  const me = await requireUser();
  const project = await loadProjectAsParty(projectId, me.id);
  if (project.status === "completed" || project.status === "cancelled") {
    throw new Error("Cannot cancel a finalised project");
  }

  await db.project.update({
    where: { id: projectId },
    data: { status: "cancelled", cancelledAt: new Date() },
  });

  revalidatePath(`/project/${projectId}`);
  return { ok: true };
}
