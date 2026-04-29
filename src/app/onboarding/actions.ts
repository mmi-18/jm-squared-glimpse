"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

type CreatorPayload = {
  name: string;
  locationCity: string;
  locationCountry: string;
  languages: string[];
  culturalMarkets: string[];
  /** All other CreatorProfile fields (camelCase keys, types match Prisma).
   *  `userId` is set inside the action — callers don't pass it. */
  profile: Omit<Prisma.CreatorProfileUncheckedCreateInput, "userId">;
};

type StartupPayload = {
  name: string;
  locationCity: string;
  locationCountry: string;
  languages: string[];
  culturalMarkets: string[];
  profile: Omit<Prisma.StartupProfileUncheckedCreateInput, "userId">;
};

const dicebearAvatar = (seed: string) =>
  `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}`;

export async function saveCreatorOnboarding(payload: CreatorPayload) {
  const user = await requireUser();

  await db.user.update({
    where: { id: user.id },
    data: {
      name: payload.name,
      image: dicebearAvatar(payload.name),
      locationCity: payload.locationCity,
      locationCountry: payload.locationCountry,
      languages: payload.languages,
      culturalMarkets: payload.culturalMarkets,
      onboardingCompleted: true,
      // userType is set on signup; force-correct it here just in case
      userType: "creator",
    },
  });

  // CreatorProfile keyed by userId; upsert lets the user re-run onboarding
  // if they want to redo their answers later.
  await db.creatorProfile.upsert({
    where: { userId: user.id },
    create: { ...payload.profile, userId: user.id },
    update: payload.profile,
  });

  redirect("/feed");
}

export async function saveStartupOnboarding(payload: StartupPayload) {
  const user = await requireUser();

  await db.user.update({
    where: { id: user.id },
    data: {
      name: payload.name,
      image: dicebearAvatar(payload.name),
      locationCity: payload.locationCity,
      locationCountry: payload.locationCountry,
      languages: payload.languages,
      culturalMarkets: payload.culturalMarkets,
      onboardingCompleted: true,
      userType: "startup",
    },
  });

  await db.startupProfile.upsert({
    where: { userId: user.id },
    create: {
      ...payload.profile,
      userId: user.id,
      contactEmail: user.email,
    },
    update: payload.profile,
  });

  redirect("/feed");
}
