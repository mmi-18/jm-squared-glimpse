import type { GridCell } from "@/components/grid/types";
import type { ProfileCellData } from "@/components/grid/cell-types";
import type { CreatorProfile, PostRow, ReviewRow, UserRow } from "@/lib/types";

type ReviewWithReviewer = Pick<
  ReviewRow,
  | "id"
  | "projectDescription"
  | "ratingOverall"
  | "ratingReliability"
  | "ratingQuality"
  | "ratingCollaboration"
  | "reviewText"
  | "createdAt"
> & {
  reviewer: Pick<UserRow, "id" | "name" | "image">;
};

/**
 * The "About" half of a Creator profile: identity / style / reviews widgets.
 * These are fixed widget cells — text cells are not used here.
 */
export function buildAboutCells(args: {
  user: UserRow;
  profile: CreatorProfile | null;
  reviews: ReviewWithReviewer[];
  avg: {
    overall: number;
    reliability: number;
    quality: number;
    collaboration: number;
  };
  /** Whether the viewer is allowed to see the creator's daily rate. */
  rateVisible: boolean;
}): GridCell<ProfileCellData>[] {
  const { user, profile, reviews, avg, rateVisible } = args;
  const cells: GridCell<ProfileCellData>[] = [];

  if (user.bio || profile?.creativePhilosophy) {
    cells.push({
      id: "about",
      span: "2x2",
      data: {
        kind: "about",
        bio: user.bio ?? profile?.creativePhilosophy ?? null,
      },
    });
  }

  cells.push({
    id: "voice",
    span: "2x1",
    data: { kind: "voice", seed: user.name ?? user.id },
  });

  if (profile && profile.styleProductionValue != null) {
    cells.push({
      id: "radar",
      span: "2x2",
      data: { kind: "radar", vector: profile },
    });
  }

  if (profile?.rateMin != null && profile?.rateMax != null) {
    cells.push({
      id: "rate",
      span: "1x1",
      data: {
        kind: "rate",
        min: profile.rateMin,
        max: profile.rateMax,
        visible: rateVisible,
      },
    });
  }

  if (profile?.deliverableTypes && profile.deliverableTypes.length > 0) {
    cells.push({
      id: "delivers",
      span: "2x1",
      data: {
        kind: "tags",
        tags: profile.deliverableTypes,
        heading: "Delivers",
      },
    });
  }

  if (profile?.industryExperience && profile.industryExperience.length > 0) {
    cells.push({
      id: "industries",
      span: "2x1",
      data: {
        kind: "tags",
        tags: profile.industryExperience,
        heading: "Industry experience",
      },
    });
  }

  if (reviews.length > 0) {
    cells.push({
      id: "reviews",
      span: "2x2",
      data: { kind: "reviews", reviews, avg },
    });
  }

  return cells;
}

/**
 * The "Portfolio" half: headings, body text, and post previews. This is the
 * creative-expression half — users can mix text blocks between tiles to
 * frame sections ("Recent work", "On location", etc.).
 *
 * Default layout (authoring overrides in Schritt 9):
 *   - Optional intro headline + body text
 *   - Post tiles cycled through 4 spans for visual rhythm
 */
export function buildPortfolioCells(args: {
  profile: CreatorProfile | null;
  posts: PostRow[];
  name: string | null;
}): GridCell<ProfileCellData>[] {
  const { profile, posts } = args;
  const cells: GridCell<ProfileCellData>[] = [];

  if (posts.length === 0) return cells;

  // Pictures FIRST — the grid should open with the hero image, not a text
  // block. Text cells only appear after the work, acting as a closing
  // statement. Users can reorder freely in the future authoring flow.
  const rhythm = ["1x2", "1x1", "2x1", "1x1", "1x1", "2x1"] as const;
  posts.forEach((post, i) => {
    const span: "1x1" | "2x1" | "1x2" | "2x2" =
      i === 0 ? "2x2" : rhythm[(i - 1) % rhythm.length];
    cells.push({
      id: `portfolio-${post.id}`,
      span,
      data: { kind: "portfolioPost", post },
    });
  });

  // Philosophy excerpt as a closing pull-quote at the bottom, if present.
  if (profile?.creativePhilosophy) {
    const philosophy = profile.creativePhilosophy;
    const firstSentence =
      philosophy.split(/(?<=[.!?])\s+/)[0] ?? philosophy.slice(0, 120);
    cells.push({
      id: "portfolio-philosophy",
      span: "2x1",
      data: {
        kind: "text",
        content: firstSentence,
      },
    });
  }

  return cells;
}
