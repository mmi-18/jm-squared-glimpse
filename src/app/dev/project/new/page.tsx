import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getOldestPendingReviewForUser } from "@/lib/reviews";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

/**
 * Dev-only manual project creator. The work-agreement form (Chunk C)
 * will replace this in production. Lives under /dev/* which is
 * disallowed by robots.txt + excluded from the sitemap.
 *
 * Picks the "other party" from a simple dropdown of users with the
 * opposite userType from the current viewer (creator ↔ startup).
 */
async function createDevProject(formData: FormData) {
  "use server";
  const me = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const otherUserId = String(formData.get("otherUserId") ?? "").trim();
  if (!title || !otherUserId) throw new Error("Missing title or other user");

  const other = await db.user.findUnique({
    where: { id: otherUserId },
    select: { id: true, userType: true },
  });
  if (!other) throw new Error("Other user not found");

  // Determine roles. Enforce the type-pair invariant.
  let clientId: string;
  let creatorId: string;
  if (me.userType === "startup" && other.userType === "creator") {
    clientId = me.id;
    creatorId = other.id;
  } else if (me.userType === "creator" && other.userType === "startup") {
    creatorId = me.id;
    clientId = other.id;
  } else {
    throw new Error(
      "Project requires one creator + one startup (current pair is invalid)",
    );
  }

  // Optional back-pointer: an existing conversation between the two.
  const conv = await db.conversation.findFirst({
    where: {
      OR: [
        { participantA: me.id, participantB: otherUserId },
        { participantA: otherUserId, participantB: me.id },
      ],
    },
    select: { id: true },
  });

  // Start in `active` so the sign-off flow can be exercised right away.
  const project = await db.project.create({
    data: {
      title,
      clientId,
      creatorId,
      conversationId: conv?.id ?? null,
      status: "active",
    },
  });

  redirect(`/project/${project.id}`);
}

export default async function DevNewProjectPage() {
  const me = await requireUser();

  // Soft block: if there's a completed project the user hasn't reviewed
  // yet, redirect them there to leave the review first. Mandatory-review
  // pattern (Uber model) — you can't book the next ride until you've
  // rated the previous one.
  const pendingReview = await getOldestPendingReviewForUser(me.id);
  if (pendingReview) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 md:px-6">
        <Link
          href="/feed"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>
        <div className="border-border bg-card flex flex-col items-start gap-3 rounded-2xl border p-6">
          <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
          <h1 className="text-xl font-medium tracking-tight">
            Review your last project first
          </h1>
          <p className="text-muted-foreground text-sm">
            You haven&apos;t left a review for{" "}
            <strong>{pendingReview.title}</strong>
            {pendingReview.counterpartyName && (
              <> with {pendingReview.counterpartyName}</>
            )}
            . Reviews are how we keep matches honest — drop a quick rating
            and you&apos;re unblocked.
          </p>
          <Link
            href={`/project/${pendingReview.id}`}
            className={buttonVariants({ size: "lg", className: "mt-2 w-full" })}
          >
            Review project →
          </Link>
        </div>
      </div>
    );
  }

  const otherUsers = await db.user.findMany({
    where: {
      id: { not: me.id },
      userType: me.userType === "startup" ? "creator" : "startup",
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-md px-4 py-10 md:px-6">
      <Link
        href="/feed"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Back to feed
      </Link>

      <h1 className="mb-2 text-2xl font-medium tracking-tight">
        Create test project
      </h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Dev-only. The structured work-agreement form (Chunk C) will
        replace this once it ships. Project is created in the{" "}
        <code className="bg-muted rounded px-1 py-0.5 text-xs">
          active
        </code>{" "}
        state so you can immediately exercise mark-delivered → sign-off.
      </p>

      <form action={createDevProject} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Project title</Label>
          <Input
            id="title"
            name="title"
            required
            defaultValue="Brand film for product launch"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="otherUserId">
            {me.userType === "startup" ? "Creator" : "Client"}
          </Label>
          <select
            id="otherUserId"
            name="otherUserId"
            required
            defaultValue=""
            className="border-border bg-background min-h-[40px] w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Pick one…
            </option>
            {otherUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email} — {u.email}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" className="w-full">
          Create project
        </Button>
      </form>
    </div>
  );
}
