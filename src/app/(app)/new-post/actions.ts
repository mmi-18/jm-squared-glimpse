"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { GridCell } from "@/components/grid/types";
import type { PostCellData } from "@/components/grid/cell-types";

export type NewPostInput = {
  title: string;
  description: string;
  industry: string;
  contentType: string;
  format: "vertical" | "horizontal" | "square";
  mediaUrls: string[];
  /** 7 style dimensions (1-10). When null, inherited from creator profile. */
  style: {
    styleProductionValue: number | null;
    stylePacing: number | null;
    styleFocus: number | null;
    styleFraming: number | null;
    styleStaging: number | null;
    styleColor: number | null;
    styleSound: number | null;
  };
};

/**
 * Build a sensible default cell layout from form inputs:
 *   - Each image becomes an image cell. First image is 2×2 (hero) when
 *     there are 2+ images; subsequent images cycle through 1×1 / 2×1 / 1×2
 *     for visual rhythm.
 *   - The description (if any) becomes a single text cell at the end.
 */
function buildCellLayout(args: {
  mediaUrls: string[];
  description: string;
}): GridCell<PostCellData>[] {
  const cells: GridCell<PostCellData>[] = [];
  const rhythm = ["1x1", "2x1", "1x1", "1x2", "1x1", "2x1"] as const;
  args.mediaUrls.forEach((src, i) => {
    const span: "1x1" | "2x1" | "1x2" | "2x2" =
      i === 0 && args.mediaUrls.length > 1
        ? "2x2"
        : (rhythm[(i - 1) % rhythm.length] as "1x1" | "2x1" | "1x2" | "2x2");
    cells.push({
      id: `img-${i}-${Math.random().toString(36).slice(2, 6)}`,
      span,
      data: { kind: "image", src, alt: "" },
    });
  });
  if (args.description.trim()) {
    cells.push({
      id: `text-${Math.random().toString(36).slice(2, 6)}`,
      span: "2x1",
      data: { kind: "text", content: args.description.trim() },
    });
  }
  return cells;
}

/**
 * Build the preview tile (mini-mosaic shown inside the uniform feed card).
 * Uses up to 4 image cells with the first as 2×2 hero when there are 2+.
 */
function buildPreviewLayout(
  mediaUrls: string[],
): GridCell<PostCellData>[] {
  const images = mediaUrls.slice(0, 4);
  if (images.length === 0) return [];
  if (images.length === 1) {
    return [
      {
        id: `prev-0`,
        span: "2x2",
        data: { kind: "image", src: images[0], alt: "" },
      },
    ];
  }
  return images.map((src, i) => ({
    id: `prev-${i}`,
    span: i === 0 ? ("2x2" as const) : ("1x1" as const),
    data: { kind: "image" as const, src, alt: "" },
  }));
}

/**
 * Create a new portfolio post. Inherits style dimensions from the creator
 * profile when the wizard didn't override them. Cell layout + preview tile
 * are auto-generated from the form inputs.
 */
export async function createPost(input: NewPostInput) {
  const user = await requireUser();

  const profile = await db.creatorProfile.findUnique({
    where: { userId: user.id },
  });

  const cellLayout = buildCellLayout({
    mediaUrls: input.mediaUrls,
    description: input.description,
  });
  const previewLayout = buildPreviewLayout(input.mediaUrls);

  const post = await db.post.create({
    data: {
      userId: user.id,
      postType: "portfolio_piece",
      title: input.title.trim() || null,
      description: input.description.trim() || null,
      mediaUrls: input.mediaUrls,
      thumbnailUrl: input.mediaUrls[0] ?? null,
      contentType:
        input.contentType || (profile?.deliverableTypes?.[0] ?? null),
      industry:
        input.industry || (profile?.industryExperience?.[0] ?? null),
      format: input.format,
      // Inherit style from profile when wizard left them at defaults; user-set
      // values come through unchanged.
      styleProductionValue:
        input.style.styleProductionValue ?? profile?.styleProductionValue ?? null,
      stylePacing: input.style.stylePacing ?? profile?.stylePacing ?? null,
      styleFocus: input.style.styleFocus ?? profile?.styleFocus ?? null,
      styleFraming: input.style.styleFraming ?? profile?.styleFraming ?? null,
      styleStaging: input.style.styleStaging ?? profile?.styleStaging ?? null,
      styleColor: input.style.styleColor ?? profile?.styleColor ?? null,
      styleSound: input.style.styleSound ?? profile?.styleSound ?? null,
      cellLayout: cellLayout as unknown as object,
      previewLayout:
        previewLayout.length > 0 ? (previewLayout as unknown as object) : undefined,
    },
    select: { id: true },
  });

  revalidatePath("/feed");
  revalidatePath(`/creator/${user.id}`);
  redirect(`/post/${post.id}`);
}
