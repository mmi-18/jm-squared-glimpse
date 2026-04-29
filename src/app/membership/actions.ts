"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function saveMembershipTier(tier: "free" | "pro") {
  const user = await requireUser();

  const updated = await db.user.update({
    where: { id: user.id },
    data: { membershipTier: tier },
    select: { userType: true },
  });

  redirect(
    updated.userType === "creator" ? "/onboarding/creator" : "/onboarding/startup",
  );
}
