import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { MatchScoreBadge } from "@/components/feed/match-score-badge";
import { MessageDialog } from "@/components/messaging/message-dialog";
import { Avatar } from "@/components/brand/avatar";
import { Button } from "@/components/ui/button";
import { PostContentGrid } from "@/components/post/post-content-grid";
import { DeletePostButton } from "@/components/post/delete-post-button";
import {
  calculateMatchScore,
  calculatePostMatchScore,
} from "@/lib/matching";
import type { CreatorProfile, StartupProfile, User } from "@/lib/types";

export const dynamic = "force-dynamic";

function humanize(s?: string | null) {
  if (!s) return "";
  return s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  const post = await db.post.findUnique({ where: { id } });
  if (!post) notFound();

  const author = await db.user.findUnique({ where: { id: post.userId } });
  if (!author) notFound();

  // Author profile (creator or startup)
  let authorCreator: CreatorProfile | null = null;
  let authorStartup: StartupProfile | null = null;
  if (author.userType === "creator") {
    authorCreator = await db.creatorProfile.findUnique({
      where: { userId: author.id },
    });
  } else {
    authorStartup = await db.startupProfile.findUnique({
      where: { userId: author.id },
    });
  }

  // Viewer profile for match calc
  let viewerCreator: CreatorProfile | null = null;
  let viewerStartup: StartupProfile | null = null;
  let viewerUser: User | null = null;
  if (currentUser && currentUser.id !== author.id) {
    viewerUser = await db.user.findUnique({ where: { id: currentUser.id } });
    if (currentUser.userType === "creator") {
      viewerCreator = await db.creatorProfile.findUnique({
        where: { userId: currentUser.id },
      });
    } else {
      viewerStartup = await db.startupProfile.findUnique({
        where: { userId: currentUser.id },
      });
    }
  }

  const industryTable = await db.industrySimilarity.findMany();

  // Profile-level match score
  let matchScore: number | null = null;
  if (viewerStartup && authorCreator) {
    const res = calculateMatchScore({
      creator: authorCreator,
      startup: viewerStartup,
      creatorUser: {
        languages: author.languages,
        culturalMarkets: author.culturalMarkets,
      },
      startupUser: {
        languages: viewerUser?.languages,
        culturalMarkets: viewerUser?.culturalMarkets,
      },
      industryTable,
    });
    matchScore = res?.totalScore ?? null;
  } else if (viewerCreator && authorStartup) {
    const res = calculateMatchScore({
      creator: viewerCreator,
      startup: authorStartup,
      creatorUser: {
        languages: viewerUser?.languages,
        culturalMarkets: viewerUser?.culturalMarkets,
      },
      startupUser: {
        languages: author.languages,
        culturalMarkets: author.culturalMarkets,
      },
      industryTable,
    });
    matchScore = res?.totalScore ?? null;
  } else if (viewerCreator && authorCreator) {
    // Creator looking at creator — show post-level vibe score
    matchScore = calculatePostMatchScore(
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

  const isOwn = currentUser?.id === author.id;
  const profileHref =
    author.userType === "creator"
      ? `/creator/${author.id}`
      : `/startup/${author.id}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/feed"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>
      </div>

      {/* Author header */}
      <div className="border-border bg-card mb-6 flex items-center justify-between rounded-2xl border p-4">
        <Link
          href={profileHref}
          className="flex items-center gap-3 hover:opacity-80"
        >
          <Avatar src={author.image} name={author.name} size={44} />
          <div>
            <p className="font-medium">{author.name}</p>
            <p className="text-muted-foreground text-xs">
              {author.userType === "creator"
                ? `${author.locationCity ?? ""} • Creator`
                : authorStartup?.industry
                  ? `${humanize(authorStartup.industry)} • Startup`
                  : "Startup"}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {matchScore != null && (
            <MatchScoreBadge score={matchScore} size="md" />
          )}
          {!isOwn ? (
            <MessageDialog
              recipientId={author.id}
              recipientName={author.name ?? "User"}
              matchScore={matchScore}
              isAuthenticated={!!currentUser}
              trigger={
                <Button>
                  <MessageCircle className="size-4" /> Send message
                </Button>
              }
            />
          ) : (
            <DeletePostButton
              postId={post.id}
              postTitle={post.title}
              variant="header"
              redirectAfter={`/creator/${author.id}`}
            />
          )}
        </div>
      </div>

      {/* Title + business-brief badge */}
      <header className="mb-6">
        {author.userType === "startup" && (
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-background">
            Business brief
          </div>
        )}
        <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
          {post.title}
        </h1>
      </header>

      {/* Content grid — each section is a cell in a SpanGrid */}
      <PostContentGrid post={post} />
    </div>
  );
}
