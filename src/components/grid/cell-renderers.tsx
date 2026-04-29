import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ImageCollage } from "@/components/feed/image-collage";
import { VoiceMessage } from "@/components/profile/voice-message";
import { StyleRadar } from "@/components/profile/style-radar";
import { ReviewsSection } from "@/components/profile/reviews-section";
import { STYLE_DIMENSIONS } from "@/lib/constants";
import type { GridCell } from "@/components/grid/types";
import type {
  PostCellData,
  ProfileCellData,
} from "@/components/grid/cell-types";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function humanize(s?: string | null) {
  if (!s) return "";
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Text cells are deliberately lighter than image cells — they're labels
// and pull-quotes, not full tiles. One uniform compact size keeps the
// authoring surface simple.
const TEXT_CELL_CLASS =
  "text-xs sm:text-sm font-normal leading-snug break-words";

/**
 * Shell every cell uses — fills its grid area, rounded corners, clips overflow.
 */
function CellShell({
  children,
  className,
  padded = false,
  background = "card",
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  background?: "card" | "transparent" | "warm" | "muted";
}) {
  const bg =
    background === "card"
      ? "bg-card border border-border"
      : background === "warm"
        ? "bg-warm"
        : background === "muted"
          ? "bg-muted"
          : "";
  return (
    <div
      className={cn(
        "flex h-full w-full overflow-hidden rounded-2xl",
        bg,
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post cells (used on the Post Detail page)
// ---------------------------------------------------------------------------

export function PostCellRenderer({
  cell,
}: {
  cell: GridCell<PostCellData>;
}) {
  const d = cell.data;
  switch (d.kind) {
    case "image": {
      const fit = d.fit ?? "cover";
      const position = d.position ?? "center";
      const useBlurFill = fit === "contain" && d.blurFill !== false;
      return (
        <CellShell background="muted">
          <div className="relative h-full w-full">
            {useBlurFill && (
              // Blurred background extract — fills letterboxed whitespace.
              <Image
                src={d.src}
                alt=""
                fill
                aria-hidden
                className="scale-[1.15] object-cover opacity-70 blur-2xl"
                sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
              />
            )}
            <Image
              src={d.src}
              alt={d.alt ?? ""}
              fill
              className={cn(
                "relative",
                fit === "contain" ? "object-contain" : "object-cover",
              )}
              style={fit === "cover" ? { objectPosition: position } : undefined}
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            />
            {d.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3">
                <p className="text-xs text-white">{d.caption}</p>
              </div>
            )}
          </div>
        </CellShell>
      );
    }
    case "text":
      // Compact label/pull-quote tile — warm background, tight padding,
      // one uniform text size. Multiple paragraphs are split on blank lines.
      return (
        <div className="bg-warm flex h-full w-full overflow-hidden rounded-2xl p-2.5 sm:p-3">
          <div
            className={cn(
              "flex h-full w-full flex-col overflow-y-auto",
              d.align === "center"
                ? "items-center justify-center text-center"
                : "items-start justify-center",
            )}
          >
            <div className="space-y-1">
              {d.content.split(/\n\n+/).map((para, i) => (
                <p
                  key={i}
                  className={cn(
                    TEXT_CELL_CLASS,
                    d.align === "center" && "text-center",
                  )}
                >
                  {para}
                </p>
              ))}
            </div>
          </div>
        </div>
      );
    case "voice":
      return (
        <CellShell padded background="card">
          <div className="flex h-full w-full items-center">
            <VoiceMessage seed={d.seed} durationSec={d.durationSec ?? 42} />
          </div>
        </CellShell>
      );
    case "styleDimensions":
      return (
        <CellShell padded background="card">
          <div className="flex h-full w-full flex-col">
            <p className="text-muted-foreground mb-3 text-xs uppercase tracking-wider">
              {d.label ?? "Style"}
            </p>
            <div className="flex-1 grid grid-cols-1 content-between gap-2 overflow-hidden">
              {STYLE_DIMENSIONS.map((dim) => {
                const value = d.vector[dim.key] ?? 5;
                return (
                  <div key={dim.key}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span>{dim.label}</span>
                      <span className="text-muted-foreground">
                        {value}/10
                      </span>
                    </div>
                    <div className="bg-muted mt-1 h-1 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-foreground h-full"
                        style={{ width: `${((value - 1) / 9) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CellShell>
      );
    case "tags":
      return (
        <CellShell padded background="warm">
          <div className="flex h-full w-full flex-col">
            {d.heading && (
              <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
                {d.heading}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {d.tags.map((t) => (
                <span
                  key={t}
                  className="border-border bg-background rounded-full border px-2 py-0.5 text-[11px]"
                >
                  {humanize(t)}
                </span>
              ))}
            </div>
          </div>
        </CellShell>
      );
  }
}

// ---------------------------------------------------------------------------
// Profile cells (used on the Creator Profile page)
// ---------------------------------------------------------------------------

export function ProfileCellRenderer({
  cell,
}: {
  cell: GridCell<ProfileCellData>;
}) {
  const d = cell.data;
  switch (d.kind) {
    case "about":
      return (
        <CellShell padded background="card">
          <div className="flex h-full w-full flex-col overflow-y-auto">
            <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
              About me
            </p>
            <div className="text-sm leading-relaxed space-y-3">
              {(d.bio ?? "").split(/\n\n+/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        </CellShell>
      );
    case "voice":
      return (
        <CellShell padded background="card">
          <div className="flex h-full w-full">
            <VoiceMessage seed={d.seed} />
          </div>
        </CellShell>
      );
    case "radar":
      return (
        <CellShell padded background="card">
          <div className="flex h-full w-full flex-col">
            <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
              Style signature
            </p>
            <div className="flex flex-1 items-center justify-center">
              <StyleRadar vector={d.vector} />
            </div>
          </div>
        </CellShell>
      );
    case "portfolioPost":
      return (
        <Link
          href={`/post/${d.post.id}`}
          className="group block h-full w-full overflow-hidden rounded-2xl"
        >
          <CellShell background="muted" className="border-none">
            <div className="relative h-full w-full">
              <ImageCollage
                images={d.post.mediaUrls ?? []}
                alt={d.post.title ?? "Portfolio piece"}
                aspect="1/1"
                className="!rounded-none h-full w-full"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent p-3">
                <p className="text-sm font-medium text-white">
                  {d.post.title}
                </p>
                {d.post.industry && (
                  <p className="text-[10px] text-white/80">
                    {humanize(d.post.industry)}
                  </p>
                )}
              </div>
            </div>
          </CellShell>
        </Link>
      );
    case "tags":
      return (
        <CellShell padded background="warm">
          <div className="flex h-full w-full flex-col overflow-hidden">
            <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
              {d.heading}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {d.tags.map((t) => (
                <span
                  key={t}
                  className="border-border bg-background rounded-full border px-2 py-0.5 text-[11px]"
                >
                  {humanize(t)}
                </span>
              ))}
            </div>
          </div>
        </CellShell>
      );
    case "rate":
      return (
        <CellShell padded background="card">
          <div className="flex h-full w-full flex-col justify-center">
            <p className="text-muted-foreground text-xs uppercase tracking-wider">
              Daily rate
            </p>
            {d.visible ? (
              <p className="mt-1 text-2xl font-medium tracking-tight">
                €{d.min ?? "—"} – €{d.max ?? "—"}
              </p>
            ) : (
              <>
                <p className="mt-1 select-none text-2xl font-medium tracking-tight blur-[6px]">
                  €{d.min ?? "0000"} – €{d.max ?? "0000"}
                </p>
                <p className="text-muted-foreground mt-3 text-[11px] leading-tight">
                  🔒 Rate reveals once you start a conversation
                </p>
              </>
            )}
          </div>
        </CellShell>
      );
    case "reviews":
      return (
        <CellShell padded background="card">
          <div className="flex h-full w-full flex-col overflow-hidden">
            <p className="text-muted-foreground mb-3 text-xs uppercase tracking-wider">
              Reviews
            </p>
            <div className="flex-1 overflow-y-auto">
              <ReviewsSection reviews={d.reviews} avg={d.avg} />
            </div>
          </div>
        </CellShell>
      );
    case "text":
      return (
        <div className="bg-warm flex h-full w-full overflow-hidden rounded-2xl p-2.5 sm:p-3">
          <p className={TEXT_CELL_CLASS}>{d.content}</p>
        </div>
      );
  }
}
