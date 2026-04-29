import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Hourly refresh is plenty for an MVP

/**
 * Dynamic sitemap. Lists every onboarded creator + startup profile so
 * Google can discover them. Public pages (landing, feed) lead, individual
 * profiles + the latest portfolio posts follow.
 *
 * Runs on the server; Prisma talks straight to Neon — no auth needed since
 * we only expose IDs of users who completed onboarding.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [users, posts] = await Promise.all([
    db.user.findMany({
      where: { onboardingCompleted: true },
      select: { id: true, userType: true, createdAt: true },
    }),
    db.post.findMany({
      where: { postType: "portfolio_piece" },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, createdAt: true },
    }),
  ]);

  const userEntries: MetadataRoute.Sitemap = users.map((u) => ({
    url: absoluteUrl(`/${u.userType}/${u.id}`),
    lastModified: u.createdAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: absoluteUrl(`/post/${p.id}`),
    lastModified: p.createdAt,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [
    {
      url: absoluteUrl("/"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/feed"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...userEntries,
    ...postEntries,
  ];
}
