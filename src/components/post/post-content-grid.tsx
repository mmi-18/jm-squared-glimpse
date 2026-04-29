"use client";

import { useState } from "react";
import { SpanGrid } from "@/components/grid/span-grid";
import { PostCellRenderer } from "@/components/grid/cell-renderers";
import { buildPostCells } from "@/components/grid/post-layout";
import type { PostCellData } from "@/components/grid/cell-types";
import type { GridCell } from "@/components/grid/types";
import type { PostRow } from "@/lib/types";

function isGridCellArray(value: unknown): value is GridCell<PostCellData>[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c) =>
        c &&
        typeof c === "object" &&
        "id" in c &&
        "span" in c &&
        "data" in c &&
        c.data &&
        typeof (c.data as { kind?: unknown }).kind === "string",
    )
  );
}

/**
 * Read-only Post Detail content: a SpanGrid of polymorphic cells (image,
 * text, voice, style-dimensions, tags).
 *
 * If the post has a user-authored `cellLayout`, that's used directly.
 * Otherwise we fall back to the default layout derived from post fields.
 */
export function PostContentGrid({ post }: { post: PostRow }) {
  const [cells, setCells] = useState<GridCell<PostCellData>[]>(() => {
    if (isGridCellArray(post.cellLayout)) {
      return post.cellLayout;
    }
    return buildPostCells(post);
  });

  return (
    <SpanGrid
      cells={cells}
      columns={{ base: 2, md: 4, lg: 6 }}
      editable={false}
      onCellsChange={setCells}
      renderCell={(cell) => (
        <PostCellRenderer cell={cell as GridCell<PostCellData>} />
      )}
    />
  );
}
