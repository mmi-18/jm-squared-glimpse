import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, MapPin, Languages, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { MatchScoreBadge } from "@/components/feed/match-score-badge";
import { MessageDialog } from "@/components/messaging/message-dialog";
import { HireDialog } from "@/components/project/hire-dialog";
import { Avatar } from "@/components/brand/avatar";
import { Button } from "@/components/ui/button";
import { ProfileContentGrid } from "@/components/profile/profile-content-grid";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { calculateMatchScore } from "@/lib/matching";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Per-profile SEO metadata: title, description, og:image (from the
 * creator's hero portfolio image). Crawlable: index + follow. Pages are
 * publicly accessible without auth so Google can render them.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await db.user.findFirst({
    where: { id, userType: "creator" },
    select: {
      name: true,
      bio: true,
      locationCity: true,
      locationCountry: true,
      image: true,
    },
  });
  if (!user) return { title: "Creator not found" };

  const profile = await db.creatorProfile.findUnique({
    where: { userId: id },
    select: {
      creativePhilosophy: true,
      industryExperience: true,
      contentCategories: true,
    },
  });
  const heroPost = await db.post.findFirst({
    where: { userId: id, postType: "portfolio_piece" },
    orderBy: { createdAt: "desc" },
    select: { thumbnailUrl: true, mediaUrls: true },
  });

  const name = user.name ?? "Creator";
  const location = [user.locationCity, user.locationCountry]
    .filter(Boolean)
    .join(", ");
  const description =
    user.bio ??
    profile?.creativePhilosophy ??
    `${name}${location ? ` — based in ${location}` : ""}. Photo and video creator on glimpse.`;
  const ogImage =
    heroPost?.thumbnailUrl ?? heroPost?.mediaUrls?.[0] ?? user.image ?? undefined;

  return {
    title: `${name}`,
    description: description.slice(0, 200),
    alternates: { canonical: `/creator/${id}` },
    openGraph: {
      type: "profile",
      title: `${name} — glimpse.`,
      description: description.slice(0, 200),
      url: absoluteUrl(`/creator/${id}`),
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

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  const user = await db.user.findFirst({
    where: { id, userType: "creator" },
  });
  if (!user) notFound();

  const [profile, posts, reviewsRaw, industryTable] = await Promise.all([
    db.creatorProfile.findUnique({ where: { userId: id } }),
    db.post.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    }),
    db.review.findMany({
      // released: true gates reviews behind the two-way blind window —
      // legacy seed reviews default to released=true so they're unaffected.
      where: { reviewedId: id, released: true },
      orderBy: { createdAt: "desc" },
      include: {
        reviewer: { select: { id: true, name: true, image: true } },
      },
    }),
    db.industrySimilarity.findMany(),
  ]);

  // Match score if viewer is a startup
  let matchScore: number | null = null;
  if (currentUser && currentUser.userType === "startup" && profile) {
    const startupProfile = await db.startupProfile.findUnique({
      where: { userId: currentUser.id },
    });
    if (startupProfile) {
      const res = calculateMatchScore({
        creator: profile,
        startup: startupProfile,
        creatorUser: {
          languages: user.languages,
          culturalMarkets: user.culturalMarkets,
        },
        startupUser: {
          languages: currentUser.languages ?? [],
          culturalMarkets: currentUser.culturalMarkets ?? [],
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

  // Daily rate is blurred by default. We reveal it when:
  //   1. the viewer is the creator themselves, or
  //   2. the viewer is a logged-in company (startup) AND a conversation
  //      already exists with this creator — the "match" signal.
  let rateVisible = isOwn;
  if (!rateVisible && currentUser && currentUser.userType === "startup") {
    const [a, b] = [currentUser.id, id].sort();
    const existing = await db.conversation.count({
      where: { participantA: a, participantB: b },
    });
    rateVisible = existing > 0;
  }

  // JSON-LD structured data for search engines (Person + ProfilePage).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: user.name,
      description: user.bio ?? profile?.creativePhilosophy ?? undefined,
      url: absoluteUrl(`/creator/${id}`),
      image: user.image ?? undefined,
      address:
        user.locationCity || user.locationCountry
          ? {
              "@type": "PostalAddress",
              addressLocality: user.locationCity ?? undefined,
              addressCountry: user.locationCountry ?? undefined,
            }
          : undefined,
      knowsLanguage: user.languages ?? undefined,
      jobTitle: "Photo and video creator",
      worksFor: { "@type": "Organization", name: "glimpse." },
      aggregateRating:
        reviews.length >= 2 && avg.overall > 0
          ? {
              "@type": "AggregateRating",
              ratingValue: avg.overall.toFixed(1),
              reviewCount: reviews.length,
              bestRating: 5,
              worstRating: 1,
            }
          : undefined,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "glimpse.",
      url: getSiteUrl(),
    },
  };

  return (
    <article className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      {/* JSON-LD: search-engine readable representation of this profile */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Section 1 — Profile header */}
      <section className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <Avatar src={user.image} name={user.name} size={96} />
        <div className="flex-1">
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
            {user.name}
          </h1>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {(user.locationCity || user.locationCountry) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {[user.locationCity, user.locationCountry]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            )}
            {user.languages && user.languages.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" />
                {user.languages.join(" / ")}
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {matchScore != null && (
              <MatchScoreBadge score={matchScore} size="lg" />
            )}
            {!isOwn ? (
              <>
                <MessageDialog
                  recipientId={user.id}
                  recipientName={user.name ?? "Creator"}
                  matchScore={matchScore}
                  isAuthenticated={!!currentUser}
                  trigger={
                    <Button variant="outline">
                      <MessageCircle className="size-4" /> Send message
                    </Button>
                  }
                />
                {/* Hire flow — only available to logged-in startups (or
                    logged-out users, who'll be sent to /login on click).
                    Hidden when a logged-in creator views another creator. */}
                {(!currentUser || currentUser.userType === "startup") && (
                  <HireDialog
                    creatorId={user.id}
                    creatorName={user.name ?? "this creator"}
                    isAuthenticated={!!currentUser}
                  />
                )}
              </>
            ) : (
              <Link
                href="/new-post"
                className="bg-foreground text-background hover:bg-foreground/90 inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors"
              >
                <Plus className="h-4 w-4" /> New post
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Content grid — portfolio posts, about, voice, radar, reviews are all
          cells in a SpanGrid. User-editable in Schritt 9. */}
      <div className="mt-10">
        <ProfileContentGrid
          user={user}
          profile={profile}
          posts={posts}
          reviews={reviews}
          avg={avg}
          rateVisible={rateVisible}
          isOwner={isOwn}
          savedPortfolioLayout={profile?.portfolioLayout ?? null}
          savedAboutLayout={profile?.aboutLayout ?? null}
        />
      </div>

      {/* Account (owner only) — primary mobile sign-out path */}
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
