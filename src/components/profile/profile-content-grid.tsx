"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Pencil, Check, RotateCcw, Loader2 } from "lucide-react";
import { SpanGrid } from "@/components/grid/span-grid";
import { ProfileCellRenderer } from "@/components/grid/cell-renderers";
import { DeletePostButton } from "@/components/post/delete-post-button";
import {
  buildAboutCells,
  buildPortfolioCells,
} from "@/components/grid/profile-layout";
import { saveProfileLayout } from "@/components/profile/actions";
import { cn } from "@/lib/utils";
import type { CellSpan, GridCell } from "@/components/grid/types";
import type { ProfileCellData } from "@/components/grid/cell-types";
import type {
  CreatorProfile,
  PostRow,
  ReviewRow,
  UserRow,
} from "@/lib/types";

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

type LayoutOverrides = Record<string, CellSpan>;

function asOverrides(value: unknown): LayoutOverrides {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }
  const out: LayoutOverrides = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === "1x1" || v === "2x1" || v === "1x2" || v === "2x2") {
      out[k] = v;
    }
  }
  return out;
}

function applyOverrides<T>(
  cells: GridCell<T>[],
  overrides: LayoutOverrides,
): GridCell<T>[] {
  return cells.map((c) =>
    overrides[c.id] ? { ...c, span: overrides[c.id] } : c,
  );
}

function toOverrides<T>(cells: GridCell<T>[]): LayoutOverrides {
  const out: LayoutOverrides = {};
  for (const c of cells) out[c.id] = c.span;
  return out;
}

/**
 * Read + (when owner) edit the Creator profile content.
 *
 * Two regions, each independently customizable:
 *   - Portfolio: post tiles + optional text closing quote
 *   - About: fixed widgets (bio, voice, radar, rate, tags, reviews)
 *
 * Non-owners see read-only. Owners see a "Customize layout" button per
 * section; entering edit mode shows resize handles on each cell and a
 * "Save" / "Reset" pair. Saves persist as per-cell span overrides so
 * content stays fresh (new posts appear; reviews update live).
 */
export function ProfileContentGrid({
  user,
  profile,
  posts,
  reviews,
  avg,
  rateVisible,
  isOwner,
  savedPortfolioLayout,
  savedAboutLayout,
}: {
  user: UserRow;
  profile: CreatorProfile | null;
  posts: PostRow[];
  reviews: ReviewWithReviewer[];
  avg: {
    overall: number;
    reliability: number;
    quality: number;
    collaboration: number;
  };
  rateVisible: boolean;
  isOwner: boolean;
  savedPortfolioLayout: unknown;
  savedAboutLayout: unknown;
}) {
  const baseAbout = useMemo(
    () => buildAboutCells({ user, profile, reviews, avg, rateVisible }),
    [user, profile, reviews, avg, rateVisible],
  );
  const basePortfolio = useMemo(
    () => buildPortfolioCells({ profile, posts, name: user.name }),
    [profile, posts, user.name],
  );

  const [aboutCells, setAboutCells] = useState<GridCell<ProfileCellData>[]>(() =>
    applyOverrides(baseAbout, asOverrides(savedAboutLayout)),
  );
  const [portfolioCells, setPortfolioCells] = useState<
    GridCell<ProfileCellData>[]
  >(() =>
    applyOverrides(basePortfolio, asOverrides(savedPortfolioLayout)),
  );

  // Track whether either section is in customize mode. While editing, we
  // don't want server-side post-list updates (e.g. after a deletePost
  // revalidate) to clobber the user's in-progress drag/resize state.
  const portfolioEditingRef = useRef(false);
  const aboutEditingRef = useRef(false);

  // When the parent server component re-fetches (router.refresh() after
  // a delete, layout save, etc.), the `posts`/`reviews`/`profile` props
  // change but our cell state was seeded once via useState's initializer
  // and would otherwise stick to the old list. This was the "delete a
  // post → tile stays until full page refresh" bug. Re-seed when the
  // base cells (computed from props) change.
  useEffect(() => {
    if (portfolioEditingRef.current) return;
    setPortfolioCells(
      applyOverrides(basePortfolio, asOverrides(savedPortfolioLayout)),
    );
  }, [basePortfolio, savedPortfolioLayout]);

  useEffect(() => {
    if (aboutEditingRef.current) return;
    setAboutCells(applyOverrides(baseAbout, asOverrides(savedAboutLayout)));
  }, [baseAbout, savedAboutLayout]);

  return (
    <div className="space-y-10">
      {portfolioCells.length > 0 && (
        <EditableSection
          title="Portfolio"
          isOwner={isOwner}
          baseCells={basePortfolio}
          cells={portfolioCells}
          onCellsChange={setPortfolioCells}
          kind="portfolio"
          editingRef={portfolioEditingRef}
        />
      )}

      <EditableSection
        title="About"
        isOwner={isOwner}
        baseCells={baseAbout}
        cells={aboutCells}
        onCellsChange={setAboutCells}
        kind="about"
        editingRef={aboutEditingRef}
      />
    </div>
  );
}

function EditableSection({
  title,
  isOwner,
  baseCells,
  cells,
  onCellsChange,
  kind,
  editingRef,
}: {
  title: string;
  isOwner: boolean;
  baseCells: GridCell<ProfileCellData>[];
  cells: GridCell<ProfileCellData>[];
  onCellsChange: React.Dispatch<
    React.SetStateAction<GridCell<ProfileCellData>[]>
  >;
  kind: "portfolio" | "about";
  /** Mirrors `editing` for the parent so the prop-sync useEffect knows
   *  to skip re-seeding state while the user is mid-customize. */
  editingRef: React.MutableRefObject<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  // Mirror local `editing` state into the parent's ref so the prop-sync
  // effect can opt out of re-seeding while we're in customize mode.
  useEffect(() => {
    editingRef.current = editing;
  }, [editing, editingRef]);

  function onSave() {
    startTransition(async () => {
      await saveProfileLayout({ kind, overrides: toOverrides(cells) });
      setEditing(false);
    });
  }

  function onReset() {
    onCellsChange(baseCells);
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-[0.12em]">
          {title}
        </h2>
        {isOwner && (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={onReset}
                  className="text-muted-foreground hover:text-foreground inline-flex min-h-[36px] items-center gap-1 px-2 text-xs"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={pending}
                  className="bg-foreground text-background inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  {pending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  {pending ? "Saving…" : "Done"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="border-border bg-card hover:bg-muted inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
              >
                <Pencil className="h-3 w-3" /> Customize
              </button>
            )}
          </div>
        )}
      </div>
      <div
        className={cn(
          "transition-[padding]",
          editing && "bg-muted/30 rounded-2xl p-3 sm:p-4",
        )}
      >
        <SpanGrid
          cells={cells}
          columns={{ base: 2, md: 4, lg: 6 }}
          editable={editing}
          onCellsChange={onCellsChange}
          renderCell={(cell) => {
            const c = cell as GridCell<ProfileCellData>;
            // Show the delete affordance only when the viewer owns this
            // profile AND we're not in customize mode. In customize mode
            // the resize/reorder controls take precedence.
            const showDelete =
              isOwner && !editing && c.data.kind === "portfolioPost";
            return (
              <div className="relative h-full w-full">
                <ProfileCellRenderer cell={c} />
                {showDelete && c.data.kind === "portfolioPost" && (
                  <DeletePostButton
                    postId={c.data.post.id}
                    postTitle={c.data.post.title}
                    variant="tile"
                  />
                )}
              </div>
            );
          }}
        />
      </div>
      {editing && (
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Drag the corner handle to resize a tile — 1×1, 2×1, 1×2, 2×2.
          Long-press a tile and drag to reorder. Hit{" "}
          <span className="font-medium">Done</span> to save.
        </p>
      )}
    </section>
  );
}
