import Link from "next/link";
import { Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PostCard } from "@/components/feed/post-card";
import { HighlightedCard } from "@/components/feed/highlighted-card";
import { calculateMatchScore, calculatePostMatchScore } from "@/lib/matching";
import type {
  Brief,
  CreatorProfile,
  IndustrySimilarity,
  Post,
  StartupProfile,
  User,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type FeedItem = {
  post: Post;
  author: Pick<
    User,
    | "id"
    | "name"
    | "image"
    | "userType"
    | "locationCity"
    | "culturalMarkets"
    | "languages"
  >;
  authorCategories: string[];
  matchScore: number | null;
  topPick: boolean;
};

function humanize(s?: string | null) {
  if (!s) return "";
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildBriefTagSet(brief: Brief | null): Set<string> {
  if (!brief) return new Set();
  const haystack = `${brief.title} ${brief.description}`.toLowerCase();
  const candidates = [
    "outdoor", "lifestyle", "automotive", "motorcycle", "luxury",
    "sustainability", "food", "maritime", "sailing", "music",
    "concert", "event", "travel", "adventure", "nature",
    "tech", "product", "industrial", "editorial", "fashion",
    "architecture", "real_estate", "battery", "energy", "corporate",
  ];
  const set = new Set<string>();
  for (const c of candidates) {
    if (haystack.includes(c)) set.add(c);
  }
  return set;
}

function postMatchesBriefTags(
  post: Post,
  authorCategories: string[],
  tags: Set<string>,
): boolean {
  if (tags.size === 0) return false;
  const pool = [
    ...(authorCategories ?? []),
    post.industry ?? "",
    post.contentType ?? "",
    post.title ?? "",
  ]
    .join(" ")
    .toLowerCase();
  for (const t of tags) {
    if (pool.includes(t)) return true;
  }
  return false;
}

type Highlight = {
  kind: "creator" | "startup";
  user: User;
  matchScore: number;
  posts: Post[];
  creator?: CreatorProfile;
  startup?: StartupProfile;
};

export default async function FeedPage() {
  const currentUser = await getCurrentUser();

  const [posts, users, industryTable, creatorProfiles, startupProfiles] =
    await Promise.all([
      db.post.findMany({
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      db.user.findMany(),
      db.industrySimilarity.findMany(),
      db.creatorProfile.findMany(),
      db.startupProfile.findMany(),
    ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const creatorProfileMap = new Map(creatorProfiles.map((c) => [c.userId, c]));
  const startupProfileMap = new Map(startupProfiles.map((s) => [s.userId, s]));

  // Posts grouped by author for the highlight image strip
  const postsByAuthor = new Map<string, Post[]>();
  for (const p of posts) {
    const arr = postsByAuthor.get(p.userId) ?? [];
    arr.push(p);
    postsByAuthor.set(p.userId, arr);
  }

  // Viewer context
  let viewerCreator: CreatorProfile | null = null;
  let viewerStartup: StartupProfile | null = null;
  let activeBrief: Brief | null = null;

  if (currentUser) {
    viewerCreator = creatorProfileMap.get(currentUser.id) ?? null;
    viewerStartup = startupProfileMap.get(currentUser.id) ?? null;
    if (
      currentUser.userType === "startup" &&
      currentUser.membershipTier === "pro"
    ) {
      activeBrief = await db.brief.findFirst({
        where: { userId: currentUser.id, active: true },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  const briefTags = buildBriefTagSet(activeBrief);

  // --- Featured highlights (profile-level matching) ---------------------
  const highlights: Highlight[] = [];
  if (currentUser && viewerStartup) {
    // Startup viewing → highlight top creators
    for (const creator of creatorProfiles) {
      if (creator.userId === currentUser.id) continue;
      const creatorUser = userMap.get(creator.userId);
      if (!creatorUser) continue;
      const res = calculateMatchScore({
        creator,
        startup: viewerStartup,
        creatorUser: {
          languages: creatorUser.languages,
          culturalMarkets: creatorUser.culturalMarkets,
        },
        startupUser: {
          languages: currentUser.languages ?? [],
          culturalMarkets: currentUser.culturalMarkets ?? [],
        },
        industryTable,
      });
      if (res) {
        highlights.push({
          kind: "creator",
          user: creatorUser,
          creator,
          matchScore: res.totalScore,
          posts: postsByAuthor.get(creator.userId)?.slice(0, 3) ?? [],
        });
      }
    }
  } else if (currentUser && viewerCreator) {
    // Creator viewing → highlight top startups
    for (const startup of startupProfiles) {
      if (startup.userId === currentUser.id) continue;
      const startupUser = userMap.get(startup.userId);
      if (!startupUser) continue;
      const res = calculateMatchScore({
        creator: viewerCreator,
        startup,
        creatorUser: {
          languages: currentUser.languages ?? [],
          culturalMarkets: currentUser.culturalMarkets ?? [],
        },
        startupUser: {
          languages: startupUser.languages,
          culturalMarkets: startupUser.culturalMarkets,
        },
        industryTable,
      });
      if (res) {
        highlights.push({
          kind: "startup",
          user: startupUser,
          startup,
          matchScore: res.totalScore,
          posts: postsByAuthor.get(startup.userId)?.slice(0, 3) ?? [],
        });
      }
    }
  }

  highlights.sort((a, b) => b.matchScore - a.matchScore);
  const topHighlights = highlights.slice(0, 3);
  const highlightedUserIds = new Set(topHighlights.map((h) => h.user.id));

  // --- Regular feed items (exclude posts from highlighted users so the
  //     same person doesn't appear as both a highlight and a tile) --------
  const items: FeedItem[] = posts
    .filter((p) => !highlightedUserIds.has(p.userId))
    .map((post) => {
      const author = userMap.get(post.userId);
      const authorCategories = [
        ...(creatorProfileMap.get(post.userId)?.contentCategories ?? []),
        ...(creatorProfileMap.get(post.userId)?.industryExperience ?? []),
      ];
      if (!author) {
        return {
          post,
          author: {
            id: post.userId,
            name: "Unknown",
            image: null,
            userType: "creator" as const,
            locationCity: null,
            culturalMarkets: [],
            languages: [],
          },
          authorCategories,
          matchScore: null,
          topPick: false,
        };
      }

      let score: number | null = null;
      if (viewerStartup && author.userType === "creator") {
        score = calculatePostMatchScore(
          post,
          {
            styleProductionValue: viewerStartup.styleProductionValue,
            stylePacing: viewerStartup.stylePacing,
            styleFocus: viewerStartup.styleFocus,
            styleFraming: viewerStartup.styleFraming,
            styleStaging: viewerStartup.styleStaging,
            styleColor: viewerStartup.styleColor,
            styleSound: viewerStartup.styleSound,
            industry: viewerStartup.industry,
            deliverablesNeeded: viewerStartup.deliverablesNeeded,
          },
          industryTable,
        );
      } else if (viewerCreator && author.userType === "startup") {
        score = calculatePostMatchScore(
          post,
          {
            styleProductionValue: viewerCreator.styleProductionValue,
            stylePacing: viewerCreator.stylePacing,
            styleFocus: viewerCreator.styleFocus,
            styleFraming: viewerCreator.styleFraming,
            styleStaging: viewerCreator.styleStaging,
            styleColor: viewerCreator.styleColor,
            styleSound: viewerCreator.styleSound,
            industry: viewerCreator.industryExperience?.[0] ?? null,
            deliverablesNeeded: viewerCreator.deliverableTypes,
          },
          industryTable,
        );
      }

      const topPick =
        activeBrief !== null &&
        author.userType === "creator" &&
        postMatchesBriefTags(post, authorCategories, briefTags);

      return { post, author, authorCategories, matchScore: score, topPick };
    });

  items.sort((a, b) => {
    if (a.topPick !== b.topPick) return a.topPick ? -1 : 1;
    if (a.matchScore != null && b.matchScore != null) {
      return b.matchScore - a.matchScore;
    }
    if (a.matchScore != null) return -1;
    if (b.matchScore != null) return 1;
    return (
      new Date(b.post.createdAt).getTime() -
      new Date(a.post.createdAt).getTime()
    );
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Feed</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {activeBrief
              ? `Ranked by your active brief: "${activeBrief.title}" — top picks flagged.`
              : currentUser
                ? "Ranked by your matches — freshest work from creators and briefs from startups."
                : "Explore creators and briefs across the platform."}
          </p>
        </div>
        {currentUser?.userType === "startup" && (
          <Link
            href="/brief"
            className="border-border bg-card hover:bg-warm inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {activeBrief ? "Edit brief" : "Create brief"}
          </Link>
        )}
      </div>

      {topHighlights.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-[0.12em]">
              Featured —{" "}
              {currentUser?.userType === "startup"
                ? "creators for you"
                : "startups you might fit"}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {topHighlights.map((h) => (
              <HighlightedCard
                key={h.user.id}
                variant={h.kind}
                href={
                  h.kind === "creator"
                    ? `/creator/${h.user.id}`
                    : h.posts[0]
                      ? `/post/${h.posts[0].id}`
                      : "#"
                }
                name={h.user.name ?? ""}
                image={h.user.image}
                subtitle={
                  h.kind === "creator"
                    ? [h.user.locationCity, h.user.locationCountry]
                        .filter(Boolean)
                        .join(", ")
                    : humanize(h.startup?.industry) || "Startup"
                }
                matchScore={h.matchScore}
                images={h.posts
                  .flatMap((p) => p.mediaUrls ?? [])
                  .filter(Boolean)
                  .slice(0, 3)}
                bio={
                  h.kind === "creator"
                    ? h.user.bio ?? h.creator?.creativePhilosophy ?? null
                    : h.startup?.brandDescription ?? null
                }
                avgRating={
                  h.creator?.avgRating != null
                    ? Number(h.creator.avgRating)
                    : null
                }
                reviewCount={h.creator?.reviewCount ?? 0}
                businessLabel={
                  h.kind === "startup" ? "Active brief" : undefined
                }
              />
            ))}
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {topHighlights.length > 0 && (
            <h2 className="text-muted-foreground mb-4 text-xs font-medium uppercase tracking-[0.12em]">
              All posts
            </h2>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((item) => (
              <PostCard key={item.post.id} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-border flex flex-col items-center rounded-2xl border border-dashed py-20 text-center">
      <h2 className="text-lg font-medium">No posts yet</h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        Sign up at <Link href="/signup" className="underline">/signup</Link> and
        create your first portfolio piece to get started.
      </p>
    </div>
  );
}
