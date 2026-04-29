import Link from "next/link";
import Image from "next/image";
import { ImageCollage } from "@/components/feed/image-collage";
import { MiniMosaic } from "@/components/feed/mini-mosaic";
import { MatchScoreBadge } from "@/components/feed/match-score-badge";
import { Avatar } from "@/components/brand/avatar";
import type { PostRow, UserRow } from "@/lib/types";
import type { GridCell } from "@/components/grid/types";
import type { PostCellData } from "@/components/grid/cell-types";
import { cn } from "@/lib/utils";

function isGridCellArray(value: unknown): value is GridCell<PostCellData>[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c) =>
        c &&
        typeof c === "object" &&
        "span" in c &&
        "data" in c &&
        c.data &&
        typeof (c.data as { kind?: unknown }).kind === "string",
    )
  );
}

type FeedItem = {
  post: PostRow;
  author: Pick<
    UserRow,
    "id" | "name" | "image" | "userType" | "locationCity"
  >;
  matchScore: number | null;
  topPick?: boolean;
};

function humanize(s?: string | null) {
  if (!s) return "";
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Feed card. Uniform sizing — each card is the same height regardless of
 * content. Square image on top + fixed 2-line footer below. Richness lives
 * on the Post Detail page, not here.
 */
export function PostCard({ item }: { item: FeedItem }) {
  if (item.author.userType === "startup") {
    return <JobCard item={item} />;
  }
  return <CreatorCard item={item} />;
}

function CardShell({
  href,
  topPick,
  children,
}: {
  href: string;
  topPick?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "border-border bg-card group flex flex-col overflow-hidden rounded-2xl border transition-colors hover:border-foreground/20",
        topPick && "ring-2 ring-[var(--match)] border-transparent",
      )}
    >
      {children}
    </Link>
  );
}

function CardFooter({
  author,
  matchScore,
  business,
  tag,
}: {
  author: FeedItem["author"];
  matchScore: number | null;
  business?: boolean;
  tag?: string | null;
}) {
  return (
    <div className="flex h-[4.5rem] flex-col justify-between gap-1.5 p-3">
      <div className="flex min-w-0 items-center gap-2">
        <Avatar
          src={author.image}
          name={author.name}
          size={22}
        />
        <p className="min-w-0 flex-1 truncate text-xs font-medium">
          {author.name}
        </p>
        {business && (
          <span className="bg-foreground text-background shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider">
            Biz
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {tag && (
          <span className="bg-warm truncate rounded-full px-2 py-0.5 text-[10px]">
            {humanize(tag)}
          </span>
        )}
        {matchScore != null && (
          <MatchScoreBadge score={matchScore} size="sm" className="ml-auto shrink-0" />
        )}
      </div>
    </div>
  );
}

function CreatorCard({ item }: { item: FeedItem }) {
  const { post, author, matchScore, topPick } = item;
  const preview = isGridCellArray(post.previewLayout)
    ? post.previewLayout
    : null;
  return (
    <CardShell href={`/post/${post.id}`} topPick={topPick}>
      {preview && preview.length > 0 ? (
        <MiniMosaic cells={preview} />
      ) : (
        <ImageCollage
          images={post.mediaUrls ?? []}
          alt={post.title ?? "Portfolio piece"}
          aspect="1/1"
          className="!rounded-none w-full"
        />
      )}
      <CardFooter
        author={author}
        matchScore={matchScore}
        tag={post.contentType ?? post.industry}
      />
    </CardShell>
  );
}

function JobCard({ item }: { item: FeedItem }) {
  const { post, author, matchScore, topPick } = item;
  const images = post.mediaUrls ?? [];

  return (
    <CardShell href={`/post/${post.id}`} topPick={topPick}>
      <div className="relative aspect-square w-full overflow-hidden">
        {images.length >= 2 ? (
          <div className="grid h-full grid-cols-2 gap-0.5">
            {images.slice(0, 2).map((src, i) => (
              <div key={i} className="relative">
                <Image
                  src={src}
                  alt={`${post.title ?? "Job"} ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 25vw, 12vw"
                />
              </div>
            ))}
          </div>
        ) : images.length === 1 ? (
          <Image
            src={images[0]}
            alt={post.title ?? "Job"}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 17vw"
          />
        ) : (
          <div className="from-warm via-surface to-background flex h-full w-full items-center justify-center bg-gradient-to-br">
            <Avatar
              src={author.image}
              name={author.name}
              size={56}
            />
          </div>
        )}
      </div>
      <CardFooter
        author={author}
        matchScore={matchScore}
        business
        tag={post.industry ?? post.contentType}
      />
    </CardShell>
  );
}
