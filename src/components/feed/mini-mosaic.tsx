import Image from "next/image";
import { cn } from "@/lib/utils";
import type { GridCell } from "@/components/grid/types";
import type { PostCellData } from "@/components/grid/cell-types";

const TEXT_MINI_CLASS =
  "text-[10px] sm:text-[11px] leading-snug text-foreground line-clamp-4";

/**
 * Compact, read-only renderer used inside a uniform feed tile. 2×2 CSS grid
 * with an aspect-square container — max 4 base cells, spans up to 2×2.
 * Pure CSS: no resize observers, no JS layout math.
 */
export function MiniMosaic({
  cells,
  className,
}: {
  cells: GridCell<PostCellData>[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden",
        className,
      )}
    >
      {cells.map((cell) => {
        const [cols, rows] = cell.span.split("x").map(Number);
        return (
          <div
            key={cell.id}
            className="relative overflow-hidden"
            style={{
              gridColumn: `span ${cols} / span ${cols}`,
              gridRow: `span ${rows} / span ${rows}`,
            }}
          >
            <MiniCell cell={cell} />
          </div>
        );
      })}
    </div>
  );
}

function MiniCell({ cell }: { cell: GridCell<PostCellData> }) {
  const d = cell.data;
  switch (d.kind) {
    case "image":
      return (
        <Image
          src={d.src}
          alt={d.alt ?? ""}
          fill
          className="object-cover"
          sizes="200px"
        />
      );
    case "text":
      return (
        <div className="bg-warm flex h-full w-full items-center justify-center p-2">
          <p className={TEXT_MINI_CLASS}>{d.content}</p>
        </div>
      );
    case "tags":
      return (
        <div className="bg-warm flex h-full w-full flex-wrap content-center items-center justify-center gap-0.5 p-1">
          {d.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full bg-background px-1.5 py-0.5 text-[8px] font-medium"
            >
              {t.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      );
    case "voice":
      // Voice notes shouldn't appear in post previews, but if they do:
      // render a subtle placeholder block.
      return <div className="bg-card h-full w-full" />;
    case "styleDimensions":
    default:
      return <div className="bg-card h-full w-full" />;
  }
}
