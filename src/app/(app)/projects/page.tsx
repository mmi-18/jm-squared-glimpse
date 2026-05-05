import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Pencil,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Avatar } from "@/components/brand/avatar";
import { getCurrentUser } from "@/lib/auth";
import {
  listProjectsForUser,
  type AttentionReason,
  type ProjectListItem,
} from "@/lib/projects";
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

function statusLabel(status: string): string {
  return (
    {
      pending: "Pending",
      active: "In progress",
      delivered: "Delivered",
      completed: "Completed",
      cancelled: "Cancelled",
    } as Record<string, string>
  )[status] ?? status;
}

function attentionCopy(
  reason: AttentionReason,
  role: "client" | "creator",
  counterpartyName: string,
): { label: string; icon: React.ComponentType<{ className?: string }> } {
  if (reason === "your_turn_to_accept") {
    return {
      label: `${counterpartyName} accepted — your turn`,
      icon: Pencil,
    };
  }
  // your_turn_to_sign_off
  return {
    label:
      role === "client"
        ? `${counterpartyName} delivered — sign off to release payment`
        : "Awaiting client sign-off",
    icon: CheckCircle2,
  };
}

function formatPriceCents(
  cents: number | null,
  currency = "EUR",
): string | null {
  if (cents == null) return null;
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(d);
}

function emptyStateCopy(userType: "creator" | "startup") {
  if (userType === "startup") {
    return {
      title: "No projects yet",
      body: "Find a creator whose style fits and click Hire to send your first offer.",
      cta: { href: "/discover", label: "Discover creators" },
    };
  }
  return {
    title: "No projects yet",
    body: "Browse companies you'd like to work with and pitch a project, or wait for an inbound offer.",
    // TODO: when /companies (or equivalent) lands, link there. For now /feed
    // is the most relevant landing surface for creators.
    cta: { href: "/feed", label: "Open feed" },
  };
}

/**
 * Workspace page — every project the viewer is on, sectioned by
 * status. The "Needs your attention" group floats to the top so the
 * single most useful next action is one click away.
 *
 * Public surface: linked from top-nav + bottom-nav for both userTypes.
 * Mirrors `/inbox` in shape — flat list of cards, sortable by activity.
 */
export default async function ProjectsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?next=/projects");

  const items = await listProjectsForUser(me.id);

  // Partition: needs-attention first; everything else by status group.
  const needsAttention = items.filter((i) => i.attention != null);
  const inProgress = items.filter(
    (i) => !i.attention && (i.project.status === "active" || i.project.status === "delivered"),
  );
  const negotiating = items.filter(
    (i) => !i.attention && i.project.status === "pending",
  );
  const completed = items.filter((i) => i.project.status === "completed");
  const cancelled = items.filter((i) => i.project.status === "cancelled");

  if (items.length === 0) {
    const empty = emptyStateCopy(me.userType as "creator" | "startup");
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <h1 className="mb-6 text-2xl font-medium tracking-tight md:text-3xl">
          Projects
        </h1>
        <div className="border-border bg-card flex flex-col items-start gap-3 rounded-2xl border p-8">
          <Briefcase className="text-muted-foreground h-7 w-7" />
          <h2 className="text-lg font-medium">{empty.title}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {empty.body}
          </p>
          <Link
            href={empty.cta.href}
            className="bg-foreground text-background hover:bg-foreground/90 mt-2 inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            {empty.cta.label} →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <h1 className="mb-6 text-2xl font-medium tracking-tight md:text-3xl">
        Projects
      </h1>

      {needsAttention.length > 0 && (
        <Section
          title="Needs your attention"
          icon={Sparkles}
          tone="amber"
          items={needsAttention}
        />
      )}
      {inProgress.length > 0 && (
        <Section title="In progress" icon={Briefcase} items={inProgress} />
      )}
      {negotiating.length > 0 && (
        <Section title="Negotiating" icon={Send} items={negotiating} />
      )}
      {completed.length > 0 && (
        <Section title="Completed" icon={CheckCircle2} items={completed} />
      )}
      {cancelled.length > 0 && (
        <Section title="Cancelled" icon={XCircle} items={cancelled} dim />
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  items,
  tone,
  dim,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: ProjectListItem[];
  tone?: "amber";
  /** Render the cards muted (used for cancelled). */
  dim?: boolean;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "amber" ? "text-amber-600" : "text-muted-foreground",
          )}
        />
        <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-[0.12em]">
          {title}
        </h2>
        <span className="text-muted-foreground text-xs">
          ({items.length})
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {items.map((it) => (
          <ProjectCard key={it.project.id} item={it} dim={dim} />
        ))}
      </div>
    </section>
  );
}

function ProjectCard({
  item,
  dim,
}: {
  item: ProjectListItem;
  dim?: boolean;
}) {
  const { project, role, counterparty, attention } = item;
  const price = formatPriceCents(project.priceCents, project.currency);
  const attn = attention
    ? attentionCopy(attention, role, counterparty.name ?? "Counterparty")
    : null;

  return (
    <Link
      href={`/project/${project.id}`}
      className={cn(
        "border-border bg-card hover:border-foreground/30 flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:p-5",
        dim && "opacity-60",
      )}
    >
      <Avatar
        src={counterparty.image}
        name={counterparty.name}
        size={48}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-medium">{project.title}</h3>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              STATUS_PALETTE[project.status] ?? STATUS_PALETTE.pending,
            )}
          >
            {statusLabel(project.status)}
          </span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {role === "client" ? "with creator" : "for client"}{" "}
          <span className="text-foreground/80 font-medium">
            {counterparty.name ?? "Unknown"}
          </span>
        </p>
        {attn && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            <attn.icon className="h-3 w-3" />
            {attn.label}
          </p>
        )}
      </div>
      <div className="text-right text-xs sm:min-w-[140px]">
        {price && (
          <p className="text-sm font-medium">{price}</p>
        )}
        {project.deadline && (
          <p className="text-muted-foreground">
            Due {formatDate(project.deadline)}
          </p>
        )}
        <p className="text-muted-foreground mt-1 inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDate(project.updatedAt)}
        </p>
      </div>
    </Link>
  );
}
