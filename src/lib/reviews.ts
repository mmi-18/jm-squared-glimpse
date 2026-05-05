import { db } from "@/lib/db";

/**
 * Returns the oldest project where the given user owes a review:
 * project status is `completed` and there's no Review row from this
 * user for that project. Returns null if nothing is pending.
 *
 * Used to:
 *   - render the soft-block banner in AppShell
 *   - gate "create new project" entry points (/dev/project/new today,
 *     the work-agreement form / "Hire again" buttons later) so users
 *     have to leave a review before starting another collaboration —
 *     the Uber pattern of mandatory rating before next ride.
 */
export async function getOldestPendingReviewForUser(
  userId: string,
): Promise<{
  id: string;
  title: string;
  counterpartyName: string | null;
} | null> {
  // Find completed projects involving the user.
  const candidates = await db.project.findMany({
    where: {
      status: "completed",
      OR: [{ clientId: userId }, { creatorId: userId }],
    },
    orderBy: { signedOffAt: "asc" },
    select: {
      id: true,
      title: true,
      clientId: true,
      creatorId: true,
      client: { select: { name: true } },
      creator: { select: { name: true } },
      reviews: {
        where: { reviewerId: userId },
        select: { id: true },
        take: 1,
      },
    },
  });

  for (const p of candidates) {
    if (p.reviews.length === 0) {
      const counterpartyName =
        userId === p.clientId ? p.creator.name : p.client.name;
      return { id: p.id, title: p.title, counterpartyName };
    }
  }
  return null;
}
