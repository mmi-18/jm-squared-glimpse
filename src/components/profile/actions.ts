"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { CellSpan } from "@/components/grid/types";

/**
 * Profile layouts are stored as span-override maps: `{ cellId: span }`.
 *
 * Rationale: the cells themselves are derived from live DB state (posts,
 * reviews, etc.). Storing the full cell payload would go stale. Storing
 * only per-cell span overrides keeps the content fresh while preserving
 * whatever custom sizing the owner picked.
 */
export type LayoutOverrides = Record<string, CellSpan>;

export async function saveProfileLayout(args: {
  kind: "portfolio" | "about";
  overrides: LayoutOverrides;
}) {
  const user = await requireUser();
  const column = args.kind === "portfolio" ? "portfolioLayout" : "aboutLayout";

  await db.creatorProfile.update({
    where: { userId: user.id },
    data: { [column]: args.overrides },
  });

  revalidatePath(`/creator/${user.id}`);
  return { ok: true };
}
