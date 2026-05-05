import { db } from "@/lib/db";

/**
 * Server-side helpers for the /projects workspace + the
 * "Projects (n)" attention badge in the nav.
 *
 * "Needs attention" = states where the *viewer* is the bottleneck:
 *   - pending negotiation: counterparty accepted, viewer hasn't
 *   - delivered: viewer is the client and hasn't signed off yet
 *
 * Pending-review state is *not* counted here because it already has
 * its own dedicated banner (see AppShell + getOldestPendingReviewForUser).
 * Counting it twice would mean every completed-but-unreviewed project
 * shows up in two places, which would be noisy.
 */

export type AttentionReason =
  | "your_turn_to_accept"
  | "your_turn_to_sign_off";

/**
 * Count the viewer's projects that need their attention.
 * Cheap COUNT query, fine to call from AppShell on every request.
 */
export async function countNeedsAttention(userId: string): Promise<number> {
  const [pendingMine, deliveredMine] = await Promise.all([
    db.project.count({
      where: {
        status: "pending",
        OR: [
          // I'm the client and the creator already accepted but I haven't
          {
            clientId: userId,
            creatorAcceptedAt: { not: null },
            clientAcceptedAt: null,
          },
          // I'm the creator and the client already accepted but I haven't
          {
            creatorId: userId,
            clientAcceptedAt: { not: null },
            creatorAcceptedAt: null,
          },
        ],
      },
    }),
    // delivered projects where I'm the client — I owe a sign-off
    db.project.count({
      where: { status: "delivered", clientId: userId },
    }),
  ]);

  return pendingMine + deliveredMine;
}

/**
 * Returns the viewer's projects with the counterparty user pre-joined
 * for tile rendering on /projects. Sort: most recently active first
 * (matches the inbox sort vibe — what you touched last is what you
 * probably want to see first).
 */
export async function listProjectsForUser(userId: string) {
  const rows = await db.project.findMany({
    where: { OR: [{ clientId: userId }, { creatorId: userId }] },
    orderBy: { updatedAt: "desc" },
    include: {
      client: {
        select: { id: true, name: true, image: true, userType: true },
      },
      creator: {
        select: { id: true, name: true, image: true, userType: true },
      },
    },
  });

  return rows.map((p) => {
    const role: "client" | "creator" =
      p.clientId === userId ? "client" : "creator";
    const counterparty = role === "client" ? p.creator : p.client;
    const attention = computeAttention(p, role);
    return { project: p, role, counterparty, attention };
  });
}

export type ProjectListItem = Awaited<
  ReturnType<typeof listProjectsForUser>
>[number];

function computeAttention(
  p: {
    status: "pending" | "active" | "delivered" | "completed" | "cancelled";
    clientAcceptedAt: Date | null;
    creatorAcceptedAt: Date | null;
  },
  role: "client" | "creator",
): AttentionReason | null {
  if (p.status === "pending") {
    if (
      role === "client" &&
      p.creatorAcceptedAt != null &&
      p.clientAcceptedAt == null
    ) {
      return "your_turn_to_accept";
    }
    if (
      role === "creator" &&
      p.clientAcceptedAt != null &&
      p.creatorAcceptedAt == null
    ) {
      return "your_turn_to_accept";
    }
  }
  if (p.status === "delivered" && role === "client") {
    return "your_turn_to_sign_off";
  }
  return null;
}
