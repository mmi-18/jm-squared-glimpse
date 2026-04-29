"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * Delete a post. Authorization is enforced in code (no Supabase RLS to
 * shoulder the work): the WHERE clause includes `userId`, so a non-owner
 * call deletes 0 rows. We still check auth to surface a friendly error
 * before talking to the DB.
 */
export async function deletePost(postId: string) {
  const user = await requireUser();

  await db.post.deleteMany({
    where: { id: postId, userId: user.id },
  });

  revalidatePath("/feed");
  revalidatePath(`/creator/${user.id}`);
  revalidatePath(`/startup/${user.id}`);
  return { ok: true };
}
