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
