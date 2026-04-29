"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function saveBrief(args: {
  title: string;
  description: string;
  referenceUrls: string[];
}) {
  const user = await requireUser();

  // Mark existing briefs inactive (we keep one active at a time for MVP)
  await db.brief.updateMany({
    where: { userId: user.id },
    data: { active: false },
  });

  await db.brief.create({
    data: {
      userId: user.id,
      title: args.title,
      description: args.description,
      referenceImageUrls: args.referenceUrls.filter(Boolean),
      active: true,
    },
  });

  revalidatePath("/feed");
  revalidatePath("/brief");
  return { ok: true };
}

export async function clearBrief() {
  const user = await requireUser();

  await db.brief.updateMany({
    where: { userId: user.id },
    data: { active: false },
  });

  revalidatePath("/feed");
  revalidatePath("/brief");
  return { ok: true };
}
