import type { GridCell } from "@/components/grid/types";
import type { PostCellData } from "@/components/grid/cell-types";
import type { PostRow } from "@/lib/types";

function humanizePostKind(s: string) {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Default cell layout for a Post Detail page. When a post authoring flow
 * ships (Schritt 9) the user-edited layout replaces this — until then, we
 * generate a reasonable default from the post's fields.
 *
 * Layout strategy:
 *   1. Description as a body-text cell (2×1)
 *   2. Images: hero as 2×2, rest as 1×1 with the occasional 2×1 for rhythm
 *   3. Tags cell (2×1)
 *   4. Style-dimensions cell (2×2 — the richest metadata widget)
 */
export function buildPostCells(post: PostRow): GridCell<PostCellData>[] {
  const cells: GridCell<PostCellData>[] = [];

  if (post.description) {
    // Long descriptions get 2x2, shorter ones 2x1.
    const span = post.description.length > 140 ? "2x2" : "2x1";
    cells.push({
      id: "desc",
      span,
      data: { kind: "text", content: post.description },
    });
  }

  const images = (post.mediaUrls ?? []).filter(Boolean);
  images.forEach((src, i) => {
    // Hero (first) image is 2×2 when multiple images exist; others cycle
    // through 1×1 / 2×1 / 1×2 for visual rhythm. Hero gets a caption
    // derived from the post's content type so images + text are mixed.
    const span: "1x1" | "2x1" | "1x2" | "2x2" =
      i === 0 && images.length > 1
        ? "2x2"
        : i % 5 === 2
          ? "2x1"
          : i % 5 === 4
            ? "1x2"
            : "1x1";
    const caption =
      i === 0 && post.contentType
        ? humanizePostKind(post.contentType)
        : undefined;

    // Default: smart cover-crop. Demo: every third image past the hero uses
    // blur-fill + contain so you can see the whole frame. Authoring
    // (Schritt 9) lets users toggle this per image.
    const useBlurFill = i >= 2 && i % 3 === 2;

    cells.push({
      id: `img-${i}`,
      span,
      data: {
        kind: "image",
        src,
        alt: post.title ?? "",
        caption,
        fit: useBlurFill ? "contain" : "cover",
        blurFill: useBlurFill,
      },
    });
  });

  const tags: string[] = [];
  if (post.contentType) tags.push(post.contentType);
  if (post.industry) tags.push(post.industry);
  if (post.format) tags.push(post.format);
  if (tags.length > 0) {
    cells.push({
      id: "tags",
      span: "2x1",
      data: { kind: "tags", tags, heading: "Tags" },
    });
  }

  if (post.styleProductionValue != null) {
    cells.push({
      id: "style",
      span: "2x2",
      data: { kind: "styleDimensions", vector: post, label: "Style of this piece" },
    });
  }

  return cells;
}
