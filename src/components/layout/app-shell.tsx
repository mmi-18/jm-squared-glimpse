import Link from "next/link";
import { Star } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getOldestPendingReviewForUser } from "@/lib/reviews";
import { countNeedsAttention } from "@/lib/projects";
import { TopNav } from "@/components/layout/top-nav";
import { BottomNav } from "@/components/layout/bottom-nav";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Oldest pending review (if any) — surfaced as a banner so the user
  // is reminded across every page until they submit. Soft-block entry
  // points (e.g. /dev/project/new, future "Hire again" buttons) read
  // the same lookup to keep the message consistent.
  const [pendingReview, projectsAttentionCount] = user
    ? await Promise.all([
        getOldestPendingReviewForUser(user.id),
        countNeedsAttention(user.id),
      ])
    : [null, 0];

  return (
    <>
      <TopNav
        user={
          user
            ? {
                id: user.id,
                name: user.name ?? null,
                image: user.image ?? null,
                userType: user.userType as "creator" | "startup",
                membershipTier: user.membershipTier as "free" | "pro",
              }
            : null
        }
        projectsAttentionCount={projectsAttentionCount}
      />
      {pendingReview && (
        <div
          className="border-b border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/40"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 md:px-6">
            <Star className="h-4 w-4 shrink-0 fill-amber-500 text-amber-500" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              <span className="font-medium">Review pending</span>
              <span className="hidden sm:inline">
                {" "}
                — rate your collaboration on{" "}
                <span className="font-medium">{pendingReview.title}</span>
                {pendingReview.counterpartyName && (
                  <> with {pendingReview.counterpartyName}</>
                )}
                .
              </span>
            </p>
            <Link
              href={`/project/${pendingReview.id}`}
              className="ml-auto whitespace-nowrap text-sm font-medium text-amber-900 underline underline-offset-4 hover:text-amber-700 dark:text-amber-100"
            >
              Review →
            </Link>
          </div>
        </div>
      )}
      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <BottomNav
        userId={user?.id ?? null}
        userType={(user?.userType as "creator" | "startup" | undefined) ?? null}
        projectsAttentionCount={projectsAttentionCount}
      />
    </>
  );
}
