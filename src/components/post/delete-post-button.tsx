"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deletePost } from "@/app/(app)/post/actions";

/**
 * Three-dot menu with a Delete option + confirmation dialog. Used:
 *   - On portfolio post tiles in the creator profile (owner only)
 *   - On the Post Detail header (owner only)
 *
 * Two visual variants:
 *   - `tile` — small absolute-positioned overlay button for a tile
 *   - `header` — inline button next to other header actions
 *
 * Calls the `deletePost` server action; on success, navigates `/redirect`
 * if provided (used on the post detail page to leave the now-deleted post),
 * otherwise just refreshes the current view.
 */
export function DeletePostButton({
  postId,
  postTitle,
  variant = "tile",
  redirectAfter,
}: {
  postId: string;
  postTitle?: string | null;
  variant?: "tile" | "header";
  /** When set, navigate here after successful delete. */
  redirectAfter?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deletePost(postId);
        setOpen(false);
        if (redirectAfter) {
          router.push(redirectAfter);
        } else {
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          // 44×44 touch target with the visible icon ~28×28 inside.
          // data-noreorder + stopPropagation so this never starts a drag
          // gesture on cells in customize mode.
          data-noreorder
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          aria-label="Post options"
          className={cn(
            variant === "tile"
              ? "absolute right-1 top-1 z-10 flex h-11 w-11 items-center justify-end p-1.5 touch-none"
              : "border-border bg-card hover:bg-muted inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
          )}
        >
          {variant === "tile" ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white shadow-sm">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </span>
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            variant="destructive"
          >
            <Trash2 className="h-4 w-4" /> Delete post
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>
              {postTitle ? `"${postTitle}"` : "This post"} will be removed
              from your portfolio and the feed. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={pending}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "Deleting…" : "Delete post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
