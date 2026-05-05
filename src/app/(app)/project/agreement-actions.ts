"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { UsageRights } from "@prisma/client";

/**
 * Work-agreement server actions (Chunk C).
 *
 * The agreement is the structured deal both parties sign before any
 * actual work happens. While `status = pending`, the project carries
 * draft terms (scope / deliverables / price / deadline / revisions /
 * usage rights). When BOTH `clientAcceptedAt` and `creatorAcceptedAt`
 * are set, status flips `pending → active` and the existing project
 * state machine (Chunk A) takes over from there.
 *
 * Mutations & invariants:
 *   - `hireCreator`: a startup creates a new pending project with
 *     terms + their own acceptance pre-set.
 *   - `amendAgreement`: either party edits the terms. The amender's
 *     acceptance is set, the counterparty's is *cleared* — they need
 *     to re-accept the new terms.
 *   - `acceptAgreement`: caller's `*AcceptedAt` is set. If both sides
 *     are now accepted, status flips to `active` in the same tx.
 *   - All mutations are gated on `status === "pending"`; once a
 *     project is active or beyond, the agreement is locked.
 */

export type AgreementInput = {
  title: string;
  scope: string;
  deliverables: string;
  /** Whole-euro amount entered by the user, converted to cents on save. */
  priceEur: number;
  /** YYYY-MM-DD. Stored as @db.Date so the time component is irrelevant. */
  deadline: string;
  revisionRounds: number;
  usageRights: UsageRights;
};

const USAGE_RIGHTS_VALUES: UsageRights[] = [
  "full_buyout",
  "limited_platform",
  "time_limited",
  "negotiable",
];

function validate(input: AgreementInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push("Project title is required");
  if (!input.scope.trim()) errors.push("Scope is required");
  if (!input.deliverables.trim()) errors.push("Deliverables are required");
  if (!Number.isFinite(input.priceEur) || input.priceEur <= 0) {
    errors.push("Price must be a positive number");
  }
  if (input.priceEur > 1_000_000) {
    errors.push("Price must be under €1,000,000");
  }
  if (!input.deadline || Number.isNaN(new Date(input.deadline).getTime())) {
    errors.push("Deadline is required");
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(input.deadline) < today) {
      errors.push("Deadline cannot be in the past");
    }
  }
  if (
    !Number.isInteger(input.revisionRounds) ||
    input.revisionRounds < 0 ||
    input.revisionRounds > 20
  ) {
    errors.push("Revision rounds must be an integer between 0 and 20");
  }
  if (!USAGE_RIGHTS_VALUES.includes(input.usageRights)) {
    errors.push("Invalid usage rights option");
  }
  return errors;
}

function toAgreementData(input: AgreementInput) {
  return {
    title: input.title.trim(),
    scope: input.scope.trim(),
    deliverables: input.deliverables.trim(),
    priceCents: Math.round(input.priceEur * 100),
    deadline: new Date(input.deadline),
    revisionRounds: input.revisionRounds,
    usageRights: input.usageRights,
  };
}

/**
 * Startup → creator: open a project with a draft agreement.
 *
 * Creates a new Project in `pending` with the terms populated and the
 * client's acceptance pre-set (the act of submitting the form *is* the
 * client's offer). Status flips to `active` once the creator accepts.
 *
 * Optionally back-links to an existing conversation between the two so
 * the project page's "Back to conversation" link works. If none exists
 * yet, the project still creates fine (conversationId = null).
 */
export async function hireCreator(args: {
  creatorId: string;
  agreement: AgreementInput;
}): Promise<{ ok: true; projectId: string } | { ok: false; errors: string[] }> {
  const me = await requireUser();
  if (me.userType !== "startup") {
    return {
      ok: false,
      errors: ["Only startup accounts can hire creators"],
    };
  }
  if (args.creatorId === me.id) {
    return { ok: false, errors: ["You can't hire yourself"] };
  }

  const creator = await db.user.findUnique({
    where: { id: args.creatorId },
    select: { id: true, userType: true },
  });
  if (!creator || creator.userType !== "creator") {
    return { ok: false, errors: ["Creator not found"] };
  }

  const errors = validate(args.agreement);
  if (errors.length) return { ok: false, errors };

  // Best-effort conversation back-link. Conversation rows are stored
  // with the participant ids in a canonical order (sorted), but the
  // schema has the unique constraint on (participantA, participantB)
  // — so we look up either ordering.
  const conv = await db.conversation.findFirst({
    where: {
      OR: [
        { participantA: me.id, participantB: creator.id },
        { participantA: creator.id, participantB: me.id },
      ],
    },
    select: { id: true },
  });

  const data = toAgreementData(args.agreement);
  const project = await db.project.create({
    data: {
      clientId: me.id,
      creatorId: creator.id,
      conversationId: conv?.id ?? null,
      status: "pending",
      title: data.title,
      scope: data.scope,
      deliverables: data.deliverables,
      priceCents: data.priceCents,
      currency: "EUR",
      deadline: data.deadline,
      revisionRounds: data.revisionRounds,
      usageRights: data.usageRights,
      // The hirer (client) implicitly accepts by submitting the form.
      // The creator still needs to accept before work starts.
      clientAcceptedAt: new Date(),
      creatorAcceptedAt: null,
    },
  });

  revalidatePath(`/project/${project.id}`);
  revalidatePath(`/creator/${creator.id}`);
  revalidatePath("/inbox");
  return { ok: true, projectId: project.id };
}

/**
 * Creator → startup: open a project with a draft agreement (the
 * "Pitch" flow). Mirror of `hireCreator`, with the roles flipped:
 * the creator's acceptance is pre-set and the startup has to accept
 * before status flips to `active`.
 *
 * Same form, same Project record, same agreement panel — just the
 * other entry door. Either side can amend after creation; whoever
 * amends has their acceptance set, and the counterparty's cleared.
 */
export async function proposeProject(args: {
  startupId: string;
  agreement: AgreementInput;
}): Promise<{ ok: true; projectId: string } | { ok: false; errors: string[] }> {
  const me = await requireUser();
  if (me.userType !== "creator") {
    return {
      ok: false,
      errors: ["Only creator accounts can pitch a project"],
    };
  }
  if (args.startupId === me.id) {
    return { ok: false, errors: ["You can't pitch yourself"] };
  }

  const startup = await db.user.findUnique({
    where: { id: args.startupId },
    select: { id: true, userType: true },
  });
  if (!startup || startup.userType !== "startup") {
    return { ok: false, errors: ["Company not found"] };
  }

  const errors = validate(args.agreement);
  if (errors.length) return { ok: false, errors };

  const conv = await db.conversation.findFirst({
    where: {
      OR: [
        { participantA: me.id, participantB: startup.id },
        { participantA: startup.id, participantB: me.id },
      ],
    },
    select: { id: true },
  });

  const data = toAgreementData(args.agreement);
  const project = await db.project.create({
    data: {
      clientId: startup.id,
      creatorId: me.id,
      conversationId: conv?.id ?? null,
      status: "pending",
      title: data.title,
      scope: data.scope,
      deliverables: data.deliverables,
      priceCents: data.priceCents,
      currency: "EUR",
      deadline: data.deadline,
      revisionRounds: data.revisionRounds,
      usageRights: data.usageRights,
      // The pitcher (creator) implicitly accepts by submitting.
      // The client still needs to accept before work starts.
      clientAcceptedAt: null,
      creatorAcceptedAt: new Date(),
    },
  });

  revalidatePath(`/project/${project.id}`);
  revalidatePath(`/startup/${startup.id}`);
  revalidatePath("/inbox");
  revalidatePath("/projects");
  return { ok: true, projectId: project.id };
}

async function loadPendingProjectAsParty(projectId: string, userId: string) {
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      OR: [{ clientId: userId }, { creatorId: userId }],
    },
  });
  if (!project) throw new Error("Project not found");
  if (project.status !== "pending") {
    throw new Error(
      `Agreement is locked — project is already ${project.status}`,
    );
  }
  return project;
}

/**
 * Either party amends the agreement. Their acceptance is set; the
 * counterparty's acceptance is cleared (they have to re-accept the
 * new terms before work can start).
 */
export async function amendAgreement(args: {
  projectId: string;
  agreement: AgreementInput;
}): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const me = await requireUser();
  const project = await loadPendingProjectAsParty(args.projectId, me.id);

  const errors = validate(args.agreement);
  if (errors.length) return { ok: false, errors };

  const data = toAgreementData(args.agreement);
  const isClient = me.id === project.clientId;
  const now = new Date();

  await db.project.update({
    where: { id: project.id },
    data: {
      ...data,
      clientAcceptedAt: isClient ? now : null,
      creatorAcceptedAt: isClient ? null : now,
    },
  });

  revalidatePath(`/project/${args.projectId}`);
  return { ok: true };
}

/**
 * Caller accepts the current agreement terms. Sets the appropriate
 * `*AcceptedAt` timestamp.
 *
 * Note (Chunk F-prep): both-accepted *no longer* flips status to
 * active by itself. The status flip now waits for the deposit —
 * `markProjectPaid` is what completes the transition. This action
 * just records that the terms are mutually agreed; the project
 * remains `pending` until money lands.
 */
export async function acceptAgreement(
  projectId: string,
): Promise<{ ok: true; bothAccepted: boolean } | { ok: false; error: string }> {
  const me = await requireUser();
  const project = await loadPendingProjectAsParty(projectId, me.id);

  // Sanity: terms must be present before acceptance is meaningful.
  if (
    !project.scope ||
    !project.deliverables ||
    project.priceCents == null ||
    !project.deadline ||
    project.revisionRounds == null ||
    !project.usageRights
  ) {
    return {
      ok: false,
      error: "Agreement is incomplete — fill in all terms first",
    };
  }

  const isClient = me.id === project.clientId;
  const now = new Date();

  await db.project.update({
    where: { id: project.id },
    data: {
      clientAcceptedAt: isClient ? now : project.clientAcceptedAt,
      creatorAcceptedAt: isClient ? project.creatorAcceptedAt : now,
      // Status stays `pending` — the deposit gate (markProjectPaid)
      // is what flips it to `active`.
    },
  });

  const bothAccepted =
    isClient
      ? project.creatorAcceptedAt != null
      : project.clientAcceptedAt != null;

  revalidatePath(`/project/${projectId}`);
  return { ok: true, bothAccepted };
}

/**
 * Client confirms the deposit. Placeholder for Chunk F-stripe — once
 * we have Stripe keys, this gets replaced by `createCheckoutSession`
 * + a webhook handler that sets `paidAt` server-side. For now, the
 * client clicks "Deposit €X to start" and we set the timestamp
 * directly (no money actually moves).
 *
 * Side effects:
 *   - `paidAt = now()`
 *   - status flips `pending → active` (preconditions: both-accepted)
 *
 * Only callable by the client party. Creators can't deposit on
 * their own project — that's a "client side of the table" action.
 */
export async function markProjectPaid(
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireUser();
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      OR: [{ clientId: me.id }, { creatorId: me.id }],
    },
  });
  if (!project) return { ok: false, error: "Project not found" };
  if (project.clientId !== me.id) {
    return {
      ok: false,
      error: "Only the client can deposit on a project",
    };
  }
  if (project.status !== "pending") {
    return {
      ok: false,
      error: `Cannot deposit — project is already ${project.status}`,
    };
  }
  if (!project.clientAcceptedAt || !project.creatorAcceptedAt) {
    return {
      ok: false,
      error: "Both parties must accept the terms before depositing",
    };
  }
  if (project.paidAt) {
    return { ok: false, error: "Already paid" };
  }

  await db.project.update({
    where: { id: project.id },
    data: {
      paidAt: new Date(),
      status: "active",
    },
  });

  revalidatePath(`/project/${projectId}`);
  revalidatePath("/projects");
  return { ok: true };
}
