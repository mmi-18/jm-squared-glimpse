import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MessageCircle,
  MapPin,
  Globe,
  Building2,
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { absoluteUrl, getSiteUrl } from "@/lib/site";
import { MatchScoreBadge } from "@/components/feed/match-score-badge";
import { MessageDialog } from "@/components/messaging/message-dialog";
import { Avatar } from "@/components/brand/avatar";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ImageCollage } from "@/components/feed/image-collage";
import { ReviewsSection } from "@/components/profile/reviews-section";
import { calculateMatchScore } from "@/lib/matching";

export const dynamic = "force-dynamic";

function humanize(s?: string | null) {
  if (!s) return "";
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Per-startup SEO metadata. Same shape as creator pages — Google indexes
 * the company profile so it can be discovered organically.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await db.user.findFirst({
    where: { id, userType: "startup" },
    select: {
      name: true,
      bio: true,
      locationCity: true,
      locationCountry: true,
      image: true,
    },
  });
  if (!user) return { title: "Startup not found" };

  const profile = await db.startupProfile.findUnique({
    where: { userId: id },
    select: {
      companyName: true,
      industry: true,
      brandDescription: true,
      companyDescription: true,
      websiteUrl: true,
    },
  });
  const heroPost = await db.post.findFirst({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    select: { thumbnailUrl: true, mediaUrls: true },
  });

  const name = profile?.companyName ?? user.name ?? "Startup";
  const description =
    profile?.brandDescription ??
    profile?.companyDescription ??
    user.bio ??
    `${name} is hiring creative freelancers on glimpse.`;
  const ogImage =
    heroPost?.thumbnailUrl ?? heroPost?.mediaUrls?.[0] ?? user.image ?? undefined;

  return {
    title: `${name}`,
    description: description.slice(0, 200),
    alternates: { canonical: `/startup/${id}` },
    openGraph: {
      type: "profile",
      title: `${name} — glimpse.`,
      description: description.slice(0, 200),
      url: absoluteUrl(`/startup/${id}`),
      siteName: "glimpse.",
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — glimpse.`,
      description: description.slice(0, 200),
      images: ogImage ? [ogImage] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

export default async function StartupProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  const user = await db.user.findFirst({
    where: { id, userType: "startup" },
  });
  if (!user) notFound();

  const [profile, posts, reviewsRaw, industryTable] = await Promise.all([
    db.startupProfile.findUnique({ where: { userId: id } }),
    db.post.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    }),
    db.review.findMany({
      where: { reviewedId: id },
      orderBy: { createdAt: "desc" },
      include: {
        reviewer: { select: { id: true, name: true, image: true } },
      },
    }),
    db.industrySimilarity.findMany(),
  ]);

  // Compute match score if viewer is a creator
  let matchScore: number | null = null;
  if (currentUser && currentUser.userType === "creator" && profile) {
    const creatorProfile = await db.creatorProfile.findUnique({
      where: { userId: currentUser.id },
    });
    if (creatorProfile) {
      const res = calculateMatchScore({
        creator: creatorProfile,
        startup: profile,
        creatorUser: {
          languages: currentUser.languages ?? [],
          culturalMarkets: currentUser.culturalMarkets ?? [],
        },
        startupUser: {
          languages: user.languages,
          culturalMarkets: user.culturalMarkets,
        },
        industryTable,
      });
      matchScore = res?.totalScore ?? null;
    }
  }

  const reviews = reviewsRaw.map((r) => ({
    id: r.id,
    reviewer: r.reviewer,
    projectDescription: r.projectDescription,
    ratingOverall: r.ratingOverall,
    ratingReliability: r.ratingReliability,
    ratingQuality: r.ratingQuality,
    ratingCollaboration: r.ratingCollaboration,
    reviewText: r.reviewText,
    createdAt: r.createdAt,
  }));

  const avgOf = (key: keyof (typeof reviews)[number]) => {
    const nums = reviews
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number");
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };

  const avg = {
    overall: avgOf("ratingOverall"),
    reliability: avgOf("ratingReliability"),
    quality: avgOf("ratingQuality"),
    collaboration: avgOf("ratingCollaboration"),
  };

  const isOwn = currentUser?.id === id;

  // JSON-LD structured data — Organization for startups so Google can
  // surface them as company profiles in search results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Organization",
      name: profile?.companyName ?? user.name,
      description:
        profile?.brandDescription ?? profile?.companyDescription ?? undefined,
      url: absoluteUrl(`/startup/${id}`),
      logo: user.image ?? undefined,
      sameAs: profile?.websiteUrl ? [profile.websiteUrl] : undefined,
      address:
        user.locationCity || user.locationCountry
          ? {
              "@type": "PostalAddress",
              addressLocality: user.locationCity ?? undefined,
              addressCountry: user.locationCountry ?? undefined,
            }
          : undefined,
      industry: profile?.industry ? humanize(profile.industry) : undefined,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "glimpse.",
      url: getSiteUrl(),
    },
  };

  return (
    <article className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header */}
      <section className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <Avatar src={user.image} name={user.name} size={96} />
        <div className="flex-1">
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
            {user.name}
          </h1>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {profile?.industry && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {humanize(profile.industry)}
              </span>
            )}
            {(user.locationCity || user.locationCountry) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {[user.locationCity, user.locationCountry]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            )}
            {profile?.websiteUrl && (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground inline-flex items-center gap-1.5"
              >
                <Globe className="h-3.5 w-3.5" />
                Website
              </a>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {matchScore != null && (
              <MatchScoreBadge score={matchScore} size="lg" />
            )}
            {!isOwn && (
              <MessageDialog
                recipientId={user.id}
                recipientName={user.name ?? "Startup"}
                matchScore={matchScore}
                isAuthenticated={!!currentUser}
                trigger={
                  <Button>
                    <MessageCircle className="size-4" /> Send message
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </section>

      {/* Briefs / job posts */}
      <section className="mt-10">
        <h2 className="text-muted-foreground mb-4 text-xs font-medium uppercase tracking-[0.12em]">
          Briefs
        </h2>
        {posts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No briefs published yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/post/${p.id}`}
                className="border-border bg-card group block overflow-hidden rounded-2xl border transition-colors hover:border-foreground/20"
              >
                {(p.mediaUrls?.length ?? 0) > 0 ? (
                  <ImageCollage
                    images={p.mediaUrls ?? []}
                    alt={p.title ?? "Brief"}
                    aspect="3/2"
                    className="!rounded-none w-full"
                  />
                ) : (
                  <div
                    className="from-warm via-surface to-background flex items-center justify-center bg-gradient-to-br"
                    style={{ aspectRatio: "3/2" }}
                  >
                    <Avatar src={user.image} name={user.name} size={64} />
                  </div>
                )}
                <div className="p-4">
                  <p className="text-sm font-medium leading-snug line-clamp-2">
                    {p.title}
                  </p>
                  {p.industry && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {humanize(p.industry)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* About */}
      <section className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h2 className="text-muted-foreground mb-4 text-xs font-medium uppercase tracking-[0.12em]">
            About
          </h2>
          {profile?.brandDescription && (
            <p className="text-sm leading-relaxed">{profile.brandDescription}</p>
          )}
          {profile?.targetAudience && profile.targetAudience.length > 0 && (
            <div className="mt-5">
              <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
                Target audience
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.targetAudience.map((t) => (
                  <span
                    key={t}
                    className="bg-warm rounded-full px-3 py-1 text-xs"
                  >
                    {humanize(t)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {profile?.qualitiesInCreator &&
            profile.qualitiesInCreator.length > 0 && (
              <div className="mt-5">
                <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
                  Looks for in creators
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.qualitiesInCreator.map((t) => (
                    <span
                      key={t}
                      className="border-border rounded-full border px-3 py-1 text-xs"
                    >
                      {humanize(t)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          {profile?.projectGoal && profile.projectGoal.length > 0 && (
            <div className="mt-5">
              <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
                Project goals
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.projectGoal.map((t) => (
                  <span
                    key={t}
                    className="border-border rounded-full border px-3 py-1 text-xs"
                  >
                    {humanize(t)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(profile?.contactPerson || profile?.contactRole) && (
            <div className="mt-5">
              <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wider">
                Contact
              </p>
              <p className="text-sm">
                {profile.contactPerson}
                {profile.contactRole && (
                  <span className="text-muted-foreground">
                    {" — "}
                    {profile.contactRole}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
        <div className="lg:col-span-2">
          {user.bio && (
            <>
              <h2 className="text-muted-foreground mb-4 text-xs font-medium uppercase tracking-[0.12em]">
                Pitch
              </h2>
              <div className="border-border bg-card rounded-2xl border p-5 text-sm leading-relaxed">
                {user.bio}
              </div>
            </>
          )}
          {currentUser?.userType === "creator" && !isOwn && (
            <div className="border-border bg-warm mt-5 rounded-2xl p-5 text-sm leading-relaxed">
              <Sparkles className="text-foreground mb-2 h-4 w-4" />
              {matchScore != null && matchScore >= 0.6
                ? "Strong fit. Reach out to start a conversation."
                : "Open to outreach — say hi if your style fits."}
            </div>
          )}
        </div>
      </section>

      {/* Reviews */}
      <section className="mt-10">
        <h2 className="text-muted-foreground mb-4 text-xs font-medium uppercase tracking-[0.12em]">
          Reviews
        </h2>
        <ReviewsSection reviews={reviews} avg={avg} />
      </section>

      {/* Account (owner only) */}
      {isOwn && (
        <section className="border-border mt-12 border-t pt-8">
          <h2 className="text-muted-foreground mb-4 text-xs font-medium uppercase tracking-[0.12em]">
            Account
          </h2>
          <div className="border-border bg-card flex flex-col items-start gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {user.membershipTier === "pro" ? "Pro account" : "Free account"}
              </p>
            </div>
            <SignOutButton />
          </div>
        </section>
      )}
    </article>
  );
}
