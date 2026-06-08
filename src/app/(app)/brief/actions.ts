"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type {
  DeliverableMedium,
  DeliverablePlatform,
  DurationBucket,
} from "@prisma/client";

export type SaveBriefInput = {
  title: string;
  description: string;
  referenceUrls: string[];
  deliverableMedium: DeliverableMedium | null;
  deliverablePlatforms: DeliverablePlatform[];
  deliverableCountMin: number | null;
  deliverableCountMax: number | null;
  deliverableDuration: DurationBucket | null;
};

/**
 * Persist or replace the viewer-startup's active brief.
 *
 * MVP convention: one active brief at a time per startup. Saving a
 * new one auto-deactivates any prior active brief — keeps the
 * matching surface simple (Feed + post-submit results always read
 * a single "current" brief).
 *
 * Validation is forgiving: structured fields are nullable so the
 * composer can save partial drafts. The composer's submit gate
 * enforces the visible requirements. The action is the last line
 * of defense against malformed input.
 */
export async function saveBrief(
  args: SaveBriefInput,
): Promise<{ ok: true; briefId: string } | { ok: false; error: string }> {
  const user = await requireUser();
  if (user.userType !== "startup") {
    return { ok: false, error: "Only startup accounts can save a brief" };
  }

  const title = args.title.trim();
  const description = args.description.trim();
  if (!title) return { ok: false, error: "Project title is required" };
  if (!description) return { ok: false, error: "A description is required" };

  // Range sanity. We allow either both null or both set; mixed is a bug.
  const { deliverableCountMin: cmin, deliverableCountMax: cmax } = args;
  if ((cmin == null) !== (cmax == null)) {
    return {
      ok: false,
      error: "Set both min and max quantity, or leave both empty",
    };
  }
  if (cmin != null && cmax != null) {
    if (cmin < 1 || cmax < 1 || cmin > 50 || cmax > 50) {
      return { ok: false, error: "Quantity must be between 1 and 50" };
    }
    if (cmin > cmax) {
      return { ok: false, error: "Min quantity must not exceed max" };
    }
  }

  // Duration is only meaningful for video. Coerce away if medium isn't
  // video — protects the data from "I picked video, then switched to
  // photo, but the duration field was stale" UI bugs.
  const duration =
    args.deliverableMedium === "video" ? args.deliverableDuration : null;

  // One-active-brief invariant: mark any other active briefs inactive,
  // then create the new one. Wrapped in a transaction so we never end
  // up with two actives or zero.
  const brief = await db.$transaction(async (tx) => {
    await tx.brief.updateMany({
      where: { userId: user.id, active: true },
      data: { active: false },
    });
    return tx.brief.create({
      data: {
        userId: user.id,
        title,
        description,
        referenceImageUrls: args.referenceUrls.filter(Boolean),
        active: true,
        deliverableMedium: args.deliverableMedium,
        deliverablePlatforms: args.deliverablePlatforms,
        deliverableCountMin: cmin,
        deliverableCountMax: cmax,
        deliverableDuration: duration,
      },
    });
  });

  revalidatePath("/feed");
  revalidatePath("/brief");
  return { ok: true, briefId: brief.id };
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

/**
 * Compute the top N creator matches for the viewer-startup, using the
 * existing creator-vs-startup-profile match score. The brief itself
 * doesn't yet influence the algorithm (see CLAUDE.md "matching" notes
 * for the planned brief-aware extension); for now the brief submission
 * is the *trigger* that surfaces these matches, not the input.
 *
 * Returns null entries filtered out (creators with incomplete profiles
 * the algorithm couldn't score).
 */
export async function getTopMatchesForViewer(
  limit = 3,
): Promise<
  Array<{
    userId: string;
    name: string | null;
    image: string | null;
    bio: string | null;
    locationCity: string | null;
    locationCountry: string | null;
    creativePhilosophy: string | null;
    avgRating: number | null;
    reviewCount: number;
    matchScore: number;
    posts: Array<{ id: string; mediaUrls: string[]; thumbnailUrl: string | null }>;
  }>
> {
  const me = await requireUser();
  if (me.userType !== "startup") return [];

  const { calculateMatchScore, industrySimilarity } = await import(
    "@/lib/matching"
  );

  const [startupProfile, creatorProfiles, users, industryTable, posts] =
    await Promise.all([
      db.startupProfile.findUnique({ where: { userId: me.id } }),
      db.creatorProfile.findMany(),
      db.user.findMany({ where: { userType: "creator" } }),
      db.industrySimilarity.findMany(),
      db.post.findMany({
        where: { postType: "portfolio_piece" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          industry: true,
          mediaUrls: true,
          thumbnailUrl: true,
          createdAt: true,
        },
      }),
    ]);

  if (!startupProfile) return [];

  const userMap = new Map(users.map((u) => [u.id, u]));
  const startupIndustry = startupProfile.industry?.toLowerCase() ?? null;

  // Rank each creator's posts by industry relevance to the startup,
  // then recency. The "hero" post for a result card is the top of
  // this list — so a sustainability-tagged shot beats a recent
  // luxury_lifestyle one for a sustainability startup. Pure recency
  // is the fallback when no post matches.
  const postsByCreator = new Map<string, typeof posts>();
  for (const p of posts) {
    const arr = postsByCreator.get(p.userId) ?? [];
    arr.push(p);
    postsByCreator.set(p.userId, arr);
  }
  for (const [, list] of postsByCreator) {
    list.sort((a, b) => {
      const aRel = startupIndustry
        ? industrySimilarity([a.industry ?? ""], startupIndustry, industryTable)
        : 0;
      const bRel = startupIndustry
        ? industrySimilarity([b.industry ?? ""], startupIndustry, industryTable)
        : 0;
      if (aRel !== bRel) return bRel - aRel;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  type Scored = {
    profile: (typeof creatorProfiles)[number];
    user: (typeof users)[number];
    matchScore: number;
  };

  const scored: Scored[] = [];
  for (const profile of creatorProfiles) {
    if (profile.userId === me.id) continue; // can't match yourself
    const user = userMap.get(profile.userId);
    if (!user) continue;
    // Soft mode: skip the null-on-hard-filter-fail return so every
    // creator gets ranked. The result panel always wants 3 picks —
    // strict mode (used by /feed) would silently drop most candidates
    // and leave us with 1-2.
    const res = calculateMatchScore({
      creator: profile,
      startup: startupProfile,
      creatorUser: {
        languages: user.languages,
        culturalMarkets: user.culturalMarkets,
      },
      startupUser: {
        languages: me.languages ?? [],
        culturalMarkets: me.culturalMarkets ?? [],
      },
      industryTable,
      softMode: true,
    });
    if (res) scored.push({ profile, user, matchScore: res.totalScore });
  }

  scored.sort((a, b) => b.matchScore - a.matchScore);

  // Display boost for the brief-results panel only.
  //
  // The raw composite score (style*0.30 + industry*0.20 + skill*0.15
  // + venture*0.10 + equipment*0.05 + personal*0.10 + reputation*0.10)
  // tops out around 0.65-0.70 even for strong matches on our current
  // seed pool — `reputation` alone caps style-perfect-but-unrated
  // creators at ~0.85. That reads as "soft fit" in the UI when the
  // matching actually intends to surface these as top picks.
  //
  // Apply a +15 percentage-point bump, capped at 95%, only on the
  // result cards. Preserves relative ranking; the /feed Featured
  // surface and the post-match score on /creator/<id> still use the
  // raw value.
  function boostForDisplay(raw: number): number {
    return Math.min(0.95, raw + 0.15);
  }

  return scored.slice(0, limit).map((s) => ({
    userId: s.user.id,
    name: s.user.name,
    image: s.user.image,
    bio: s.user.bio,
    locationCity: s.user.locationCity,
    locationCountry: s.user.locationCountry,
    creativePhilosophy: s.profile.creativePhilosophy,
    avgRating:
      s.profile.avgRating != null ? Number(s.profile.avgRating) : null,
    reviewCount: s.profile.reviewCount,
    matchScore: boostForDisplay(s.matchScore),
    posts: (postsByCreator.get(s.user.id) ?? []).slice(0, 3).map((p) => ({
      id: p.id,
      mediaUrls: p.mediaUrls ?? [],
      thumbnailUrl: p.thumbnailUrl,
    })),
  }));
}
