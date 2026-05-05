import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Avatar } from "@/components/brand/avatar";
import { ProjectActions } from "./project-actions";
import { ReviewForm } from "./review-form";
import { AgreementPanel } from "@/components/project/agreement-panel";
import { PendingCancelRow } from "@/components/project/pending-cancel-row";
import { PaymentStatusCard } from "@/components/project/payment-status-card";
import { DeliverySubmitForm } from "@/components/project/delivery-submit-form";
import {
  DeliveryPanel,
  type DeliveryFile,
} from "@/components/project/delivery-panel";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_PALETTE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  delivered:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function statusLabel(status: string, role: "client" | "creator"): string {
  if (status === "delivered") {
    return role === "client"
      ? "Awaiting your approval"
      : "Awaiting client approval";
  }
  return (
    {
      pending: "Pending",
      active: "In progress",
      completed: "Completed",
      cancelled: "Cancelled",
    } as Record<string, string>
  )[status] ?? status;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireUser();

  const project = await db.project.findFirst({
    where: {
      id,
      OR: [{ clientId: me.id }, { creatorId: me.id }],
    },
    include: {
      client: {
        select: { id: true, name: true, image: true, userType: true },
      },
      creator: {
        select: { id: true, name: true, image: true, userType: true },
      },
      conversation: { select: { id: true } },
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      // Latest delivery (we only ever have one in v1; the orderBy +
      // take:1 future-proofs for revision rounds in Chunk G).
      deliveries: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!project) notFound();

  const role: "client" | "creator" =
    project.clientId === me.id ? "client" : "creator";

  // Reviews surface logic for the two-way blind flow
  const myReview = project.reviews.find((r) => r.reviewerId === me.id);
  const counterpartyReview = project.reviews.find(
    (r) => r.reviewerId !== me.id,
  );
  const counterparty = role === "client" ? project.creator : project.client;
  const showReviewForm = project.status === "completed" && !myReview;
  // Released reviews are visible to both. Unreleased ones — show only the
  // viewer's own (so they can verify they submitted) without leaking content.
  const releasedReviews = project.reviews.filter((r) => r.released);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      {/* Back link — to the originating conversation if there is one,
          otherwise to the inbox. */}
      <Link
        href={
          project.conversation
            ? `/inbox/${project.conversation.id}`
            : "/inbox"
        }
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        {project.conversation ? "Back to conversation" : "Back to inbox"}
      </Link>

      {/* Title + status pill */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight">
          {project.title}
        </h1>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
            STATUS_PALETTE[project.status] ?? STATUS_PALETTE.pending,
          )}
        >
          {statusLabel(project.status, role)}
        </span>
      </div>

      {/* Parties — both are clickable through to their profiles. */}
      <div className="border-border bg-card mb-6 grid gap-2 rounded-2xl border p-4 sm:grid-cols-2">
        <Link
          href={`/startup/${project.client.id}`}
          aria-label="View client profile"
          className="hover:bg-muted flex items-center gap-3 rounded-lg p-2 transition-colors"
        >
          <Avatar
            src={project.client.image}
            name={project.client.name}
            size={40}
          />
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Client</p>
            <p className="truncate font-medium">{project.client.name}</p>
          </div>
        </Link>
        <Link
          href={`/creator/${project.creator.id}`}
          aria-label="View creator profile"
          className="hover:bg-muted flex items-center gap-3 rounded-lg p-2 transition-colors"
        >
          <Avatar
            src={project.creator.image}
            name={project.creator.name}
            size={40}
          />
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Creator</p>
            <p className="truncate font-medium">{project.creator.name}</p>
          </div>
        </Link>
      </div>

      {/* Timeline metadata. The agreed price + deadline + revisions live
          inside the agreement panel below; this card just shows the
          state-machine timestamps (started / signed-off / cancelled). */}
      <div className="border-border bg-card mb-6 rounded-2xl border p-4 text-sm">
        <dl className="grid grid-cols-3 gap-y-2">
          <dt className="text-muted-foreground">Started</dt>
          <dd className="col-span-2">{formatDate(project.createdAt)}</dd>

          {project.signedOffAt && (
            <>
              <dt className="text-muted-foreground">Signed off</dt>
              <dd className="col-span-2">
                {formatDate(project.signedOffAt)}
              </dd>
            </>
          )}

          {project.cancelledAt && (
            <>
              <dt className="text-muted-foreground">Cancelled</dt>
              <dd className="col-span-2">
                {formatDate(project.cancelledAt)}
              </dd>
            </>
          )}
        </dl>
      </div>

      {/* Money state widget (Chunk F-prep) — renders only when there's
          something to say (deposit landed, payout scheduled, payout
          released, or refunded). Hidden during pre-deposit pending. */}
      <PaymentStatusCard
        paidAt={project.paidAt}
        payoutScheduledFor={project.payoutScheduledFor}
        payoutReleasedAt={project.payoutReleasedAt}
        cancelledAt={project.cancelledAt}
        priceCents={project.priceCents}
        currency={project.currency}
        viewerRole={role}
      />

      {/* Pending — show the work agreement (Chunk C). When status is
          pending, the project doesn't have its standard action bar
          yet — the agreement IS the action surface (accept / amend).
          Once both sides accept, status flips to active and the
          ProjectActions block below takes over. */}
      {project.status === "pending" && (
        <AgreementPanel
          projectId={project.id}
          agreement={{
            title: project.title,
            scope: project.scope,
            deliverables: project.deliverables,
            priceCents: project.priceCents,
            currency: project.currency,
            deadline: project.deadline,
            revisionRounds: project.revisionRounds,
            usageRights: project.usageRights,
            clientAcceptedAt: project.clientAcceptedAt,
            creatorAcceptedAt: project.creatorAcceptedAt,
            paidAt: project.paidAt,
          }}
          viewerRole={role}
          viewerCanEdit
          clientName={project.client.name ?? "Client"}
          creatorName={project.creator.name ?? "Creator"}
        />
      )}

      {/* Active+ — the existing project state-machine action bar
          (sign-off / cancel / undo). Mark-as-delivered is now the
          DeliverySubmitForm below; the bar handles the other
          transitions. */}
      {project.status !== "pending" && project.status !== "cancelled" && (
        <ProjectActions
          projectId={project.id}
          role={role}
          status={project.status}
          signedOffAt={project.signedOffAt?.toISOString() ?? null}
        />
      )}

      {/* Delivery submission (Chunk E) — creator-only, status=active.
          Replaces the old one-click "Mark as delivered" button with
          a real upload form. Status flips active → delivered the
          moment the form is submitted. */}
      {role === "creator" && project.status === "active" && (
        <div className="mt-6">
          <DeliverySubmitForm projectId={project.id} />
        </div>
      )}

      {/* Delivery viewer (Chunk E) — both parties see the submitted
          file manifest + creator's note from the moment status flips
          to delivered onwards. Manifest is immutable post-submit. */}
      {project.status !== "pending" && project.deliveries[0] && (
        <DeliveryPanel
          delivery={{
            id: project.deliveries[0].id,
            message: project.deliveries[0].message,
            files:
              (project.deliveries[0].files as unknown as DeliveryFile[]) ?? [],
            createdAt: project.deliveries[0].createdAt,
          }}
          viewerRole={role}
        />
      )}

      {/* Pending projects can also be cancelled outright. The
          ProjectActions component handles that for active/delivered;
          for pending we render a small inline cancel here so the
          user isn't trapped in a stale negotiation. */}
      {project.status === "pending" && (
        <PendingCancelRow projectId={project.id} />
      )}

      {project.status === "delivered" && role === "creator" && (
        <p className="text-muted-foreground mt-4 text-sm">
          You&apos;ve marked this project as delivered. Waiting on the
          client to sign off.
        </p>
      )}

      {/* Review form — completed projects, only if the viewer hasn't
          submitted theirs yet. */}
      {showReviewForm && (
        <ReviewForm
          projectId={project.id}
          counterpartyName={counterparty.name}
          viewerRole={role}
        />
      )}

      {/* Already submitted, but counterparty hasn't yet → "thanks, waiting
          on them" status card. */}
      {project.status === "completed" &&
        myReview &&
        !counterpartyReview && (
          <div className="border-border bg-card mt-6 rounded-2xl border p-4 text-sm">
            <p className="font-medium">Review submitted ✓</p>
            <p className="text-muted-foreground mt-1">
              Waiting on {counterparty.name ?? "the other party"} to
              submit theirs. Once they do — or after 14 days — both
              reviews go live on your profiles.
            </p>
          </div>
        )}

      {/* Both submitted and released → show them inline. */}
      {releasedReviews.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Reviews
          </h2>
          <div className="space-y-3">
            {releasedReviews.map((r) => (
              <div
                key={r.id}
                className="border-border bg-card rounded-2xl border p-4"
              >
                <div className="mb-2 flex items-center gap-3">
                  <Avatar
                    src={r.reviewer.image}
                    name={r.reviewer.name}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.reviewer.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {r.direction === "client_to_creator"
                        ? "Client → Creator"
                        : "Creator → Client"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-medium">
                      {r.ratingOverall}
                      <span className="text-muted-foreground"> / 5</span>
                    </span>
                  </div>
                </div>
                {r.reviewText && (
                  <p className="text-sm leading-relaxed">{r.reviewText}</p>
                )}
                <dl className="mt-3 grid grid-cols-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Reliability</dt>
                  <dd className="col-span-2">{r.ratingReliability} / 5</dd>
                  <dt className="text-muted-foreground">Quality</dt>
                  <dd className="col-span-2">{r.ratingQuality} / 5</dd>
                  <dt className="text-muted-foreground">Collaboration</dt>
                  <dd className="col-span-2">{r.ratingCollaboration} / 5</dd>
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
