import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { Avatar } from "@/components/brand/avatar";
import { MatchScoreBadge } from "@/components/feed/match-score-badge";
import { cn } from "@/lib/utils";

export type HighlightedCardProps = {
  variant: "creator" | "startup";
  href: string;
  name: string;
  image: string | null;
  subtitle: string;
  matchScore: number;
  /** Up to 3 image URLs for the image strip. */
  images: string[];
  bio?: string | null;
  /** Creators only. */
  avgRating?: number | null;
  reviewCount?: number;
  /** Startups only. Label for the badge (e.g. "Active brief"). */
  businessLabel?: string;
};

/**
 * Rich showcase card used in the Featured section of the feed. Shows a
 * creator (to startups) or a startup (to creators) with a portfolio
 * strip, bio snippet, and social proof. Spans multiple normal feed tiles.
 */
export function HighlightedCard({
  variant,
  href,
  name,
  image,
  subtitle,
  matchScore,
  images,
  bio,
  avgRating,
  reviewCount,
  businessLabel,
}: HighlightedCardProps) {
  const isStartup = variant === "startup";
  return (
    <Link
      href={href}
      className="border-border bg-card group flex h-full flex-col overflow-hidden rounded-3xl border transition-all hover:border-foreground/20 hover:shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={image} name={name} size={44} />
          <div className="min-w-0">
            <p className="truncate text-base font-medium leading-tight">
              {name}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {subtitle}
            </p>
          </div>
        </div>
        <MatchScoreBadge score={matchScore} size="md" className="shrink-0" />
      </div>

      {/* Image strip */}
      {images.length > 0 && (
        <div
          className={cn(
            "grid gap-0.5 px-4",
            images.length === 1
              ? "grid-cols-1"
              : images.length === 2
                ? "grid-cols-2"
                : "grid-cols-3",
          )}
        >
          {images.slice(0, 3).map((src, i) => (
            <div
              key={i}
              className="relative aspect-square overflow-hidden rounded-xl bg-muted"
            >
              <Image
                src={src}
                alt={`${name} work ${i + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 30vw, 15vw"
              />
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        {bio && (
          <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
            {bio}
          </p>
        )}

        {/* Social proof row */}
        <div className="mt-3 flex items-center gap-3 text-xs">
          {isStartup ? (
            businessLabel && (
              <span className="bg-foreground text-background rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                {businessLabel}
              </span>
            )
          ) : avgRating != null && (reviewCount ?? 0) >= 2 ? (
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-3 w-3 fill-foreground text-foreground" />
              <span className="font-medium">{avgRating.toFixed(1)}</span>
              <span className="text-muted-foreground">
                ({reviewCount})
              </span>
            </span>
          ) : null}
        </div>

        {/* CTA */}
        <div className="border-border mt-4 flex items-center justify-between border-t pt-3">
          <span className="text-xs font-medium uppercase tracking-wider">
            {isStartup ? "View brief" : "View profile"}
          </span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
