import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Avatar } from "@/components/brand/avatar";
import { ProjectActions } from "./project-actions";
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
    },
  });

  if (!project) notFound();

  const role: "client" | "creator" =
    project.clientId === me.id ? "client" : "creator";

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

      {/* Timeline metadata. Just dates for now; revision rounds + price
          land with the work-agreement (Chunk C). */}
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

      {/* Action bar — only when there's something the user can do. */}
      {project.status !== "cancelled" && (
        <ProjectActions
          projectId={project.id}
          role={role}
          status={project.status}
          signedOffAt={project.signedOffAt?.toISOString() ?? null}
        />
      )}

      {project.status === "delivered" && role === "creator" && (
        <p className="text-muted-foreground mt-4 text-sm">
          You&apos;ve marked this project as delivered. Waiting on the
          client to sign off.
        </p>
      )}

      {project.status === "completed" &&
        (role === "client"
          ? null /* undo button shows when within 24h */
          : null)}
    </div>
  );
}
