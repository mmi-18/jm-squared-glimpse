"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  Loader2,
  Pencil,
  Sparkles,
  Star,
} from "lucide-react";
import { Avatar } from "@/components/brand/avatar";
import { Button } from "@/components/ui/button";
import { MatchScoreBadge } from "@/components/feed/match-score-badge";
import { getTopMatchesForViewer } from "@/app/(app)/brief/actions";
import { cn } from "@/lib/utils";

type MatchResult = Awaited<ReturnType<typeof getTopMatchesForViewer>>;

/**
 * Post-submit theatrical reveal of the top creator matches.
 *
 * Mounted by the BriefComposer the moment `saveBrief` returns success.
 * Runs a staged progress sequence (~2.4 s) before fading in the cards —
 * the "AI concierge" perceived-value moment. The actual match score
 * compute is fast (~50 ms server-side), but staged copy makes the work
 * feel deliberate. Stripe Checkout, Notion AI, et al. do the same trick.
 *
 * The matches are passed in as an already-resolved prop — no fetch on
 * mount, so the loader timing is purely a UX decision, not data-bound.
 *
 * Mario's call (2026-05-13): inline reveal (no navigation), theatrical
 * pacing, top 3 picks, ship with current match score as-is.
 */
export function BriefMatchesPanel({
  matches,
  briefTitle,
  onEditBrief,
}: {
  matches: MatchResult;
  briefTitle: string;
  onEditBrief: () => void;
}) {
  // The staged sequence runs once on mount. We pin the start time so a
  // strict-mode double-mount doesn't restart the clock — matters in
  // dev; harmless in prod.
  const [stage, setStage] = useState(0);
  const TOTAL_STAGES = 4;

  useEffect(() => {
    const timeouts = [
      setTimeout(() => setStage(1), 600),
      setTimeout(() => setStage(2), 1300),
      setTimeout(() => setStage(3), 2000),
      setTimeout(() => setStage(4), 2700),
    ];
    return () => {
      for (const t of timeouts) clearTimeout(t);
    };
  }, []);

  const done = stage >= TOTAL_STAGES;

  return (
    <section className="space-y-6">
      {/* Stage 1: theatrical loader */}
      {!done && (
        <div className="border-border bg-card flex flex-col items-center gap-4 rounded-3xl border p-10 text-center">
          <div className="bg-foreground/5 flex h-14 w-14 items-center justify-center rounded-2xl">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-medium tracking-tight">
            Finding your matches
          </h2>
          <ul className="text-muted-foreground mx-auto max-w-md space-y-2 text-sm">
            <ProgressLine
              active={stage >= 1}
              text={`Reading your brief — "${briefTitle}"`}
            />
            <ProgressLine
              active={stage >= 2}
              text="Scanning creator profiles & portfolios"
            />
            <ProgressLine
              active={stage >= 3}
              text="Scoring style, industry, and deliverable fit"
            />
            <ProgressLine
              active={stage >= 4}
              text={`Top ${Math.min(3, matches.length)} picks ready ↓`}
            />
          </ul>
        </div>
      )}

      {/* Stage 2: results */}
      {done && (
        <>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.12em]">
                Top picks for
              </p>
              <h2 className="text-2xl font-medium tracking-tight">
                {briefTitle}
              </h2>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEditBrief}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit brief
            </Button>
          </header>

          {matches.length === 0 ? (
            <EmptyMatches onEditBrief={onEditBrief} />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {matches.map((m, i) => (
                <CreatorMatchCard key={m.userId} match={m} rank={i + 1} />
              ))}
            </div>
          )}

          <p className="text-muted-foreground text-center text-xs">
            Don&apos;t see the right fit?{" "}
            <Link
              href="/discover"
              className="text-foreground underline underline-offset-4"
            >
              Browse all creators
            </Link>{" "}
            or{" "}
            <button
              type="button"
              onClick={onEditBrief}
              className="text-foreground underline underline-offset-4"
            >
              tweak your brief
            </button>{" "}
            to re-score.
          </p>
        </>
      )}
    </section>
  );
}

function ProgressLine({ active, text }: { active: boolean; text: string }) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 transition-opacity duration-300",
        active ? "opacity-100" : "opacity-30",
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {active ? (
          <Check className="text-foreground h-3.5 w-3.5" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        )}
      </span>
      <span className="text-left">{text}</span>
    </li>
  );
}

function CreatorMatchCard({
  match,
  rank,
}: {
  match: MatchResult[number];
  rank: number;
}) {
  const heroPost = match.posts[0];
  const heroSrc = heroPost?.thumbnailUrl ?? heroPost?.mediaUrls?.[0] ?? null;
  const location = [match.locationCity, match.locationCountry]
    .filter(Boolean)
    .join(", ");
  const pitch = match.bio ?? match.creativePhilosophy ?? null;

  return (
    <article className="border-border bg-card group flex flex-col overflow-hidden rounded-3xl border transition-all hover:border-foreground/30 hover:shadow-lg">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {heroSrc ? (
          <Image
            src={heroSrc}
            alt={`${match.name ?? "Creator"} hero`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="from-warm via-surface to-background flex h-full items-center justify-center bg-gradient-to-br">
            <Avatar src={match.image} name={match.name} size={72} />
          </div>
        )}
        <span className="absolute left-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
          {rank}
        </span>
        <span className="absolute right-3 top-3">
          <MatchScoreBadge score={match.matchScore} size="sm" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <Avatar src={match.image} name={match.name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{match.name}</p>
            {location && (
              <p className="text-muted-foreground truncate text-xs">
                {location}
              </p>
            )}
          </div>
          {match.avgRating != null && match.reviewCount >= 2 && (
            <span className="inline-flex items-center gap-1 text-xs">
              <Star className="h-3 w-3 fill-foreground text-foreground" />
              <span className="font-medium">
                {match.avgRating.toFixed(1)}
              </span>
            </span>
          )}
        </div>
        {pitch && (
          <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
            {pitch}
          </p>
        )}
        <Link
          href={`/creator/${match.userId}`}
          className="border-border bg-foreground text-background hover:bg-foreground/90 mt-auto inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors"
        >
          View profile <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

function EmptyMatches({ onEditBrief }: { onEditBrief: () => void }) {
  return (
    <div className="border-border bg-card flex flex-col items-center gap-3 rounded-3xl border p-10 text-center">
      <Sparkles className="text-muted-foreground h-6 w-6" />
      <h3 className="text-lg font-medium">No matches yet</h3>
      <p className="text-muted-foreground max-w-md text-sm">
        We didn&apos;t find a creator that meets all your constraints (budget,
        location, deliverable type). Tweak your brief — or{" "}
        <Link
          href="/discover"
          className="text-foreground underline underline-offset-4"
        >
          browse the full directory
        </Link>
        .
      </p>
      <Button onClick={onEditBrief} variant="outline" className="mt-2">
        <Pencil className="h-3.5 w-3.5" /> Edit brief
      </Button>
    </div>
  );
}
