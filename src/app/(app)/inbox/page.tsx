import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, Send } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { MatchScoreBadge } from "@/components/feed/match-score-badge";
import { Avatar } from "@/components/brand/avatar";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const conversations = await db.conversation.findMany({
    where: {
      OR: [
        { participantA: currentUser.id },
        { participantB: currentUser.id },
      ],
    },
    orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }],
  });

  const otherIds = conversations.map((c) =>
    c.participantA === currentUser.id ? c.participantB : c.participantA,
  );

  const [users, lastMsgs, unreadRows, projects] = await Promise.all([
    otherIds.length > 0
      ? db.user.findMany({
          where: { id: { in: otherIds } },
          select: { id: true, name: true, image: true, userType: true },
        })
      : Promise.resolve([]),
    conversations.length > 0
      ? db.message.findMany({
          where: { conversationId: { in: conversations.map((c) => c.id) } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    db.message.findMany({
      where: { receiverId: currentUser.id, read: false },
      select: { conversationId: true },
    }),
    // Active project surface: anything that isn't cancelled, both sides
    db.project.findMany({
      where: {
        OR: [{ clientId: currentUser.id }, { creatorId: currentUser.id }],
        status: { not: "cancelled" },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        client: { select: { id: true, name: true, image: true } },
        creator: { select: { id: true, name: true, image: true } },
      },
    }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const lastByConv = new Map<string, (typeof lastMsgs)[number]>();
  for (const m of lastMsgs) {
    if (m.conversationId && !lastByConv.has(m.conversationId)) {
      lastByConv.set(m.conversationId, m);
    }
  }
  const unreadByConv = new Map<string, number>();
  for (const r of unreadRows) {
    if (!r.conversationId) continue;
    unreadByConv.set(
      r.conversationId,
      (unreadByConv.get(r.conversationId) ?? 0) + 1,
    );
  }

  // Sort by match score (primary), then recency
  conversations.sort((a, b) => {
    const aScore = a.matchScore ?? -1;
    const bScore = b.matchScore ?? -1;
    if (aScore !== bScore) return bScore - aScore;
    return (
      new Date(b.lastMessageAt ?? b.createdAt).getTime() -
      new Date(a.lastMessageAt ?? a.createdAt).getTime()
    );
  });

  // Surface projects that need the viewer's attention first
  // (delivered → client should sign off; active → creator is working).
  const projectsNeedingAttention = projects.filter((p) => {
    if (p.clientId === currentUser.id && p.status === "delivered") return true;
    if (p.creatorId === currentUser.id && p.status === "active") return true;
    return false;
  });
  const otherProjects = projects.filter(
    (p) => !projectsNeedingAttention.includes(p),
  );
  const orderedProjects = [...projectsNeedingAttention, ...otherProjects];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <h1 className="text-3xl font-medium tracking-tight">Inbox</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Sorted by match score — your highest-fit conversations are on top.
      </p>

      {orderedProjects.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Projects
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {orderedProjects.map((p) => {
              const role: "client" | "creator" =
                p.clientId === currentUser.id ? "client" : "creator";
              const counterparty =
                role === "client" ? p.creator : p.client;
              const needsYou =
                (role === "client" && p.status === "delivered") ||
                (role === "creator" && p.status === "active");

              const Icon =
                p.status === "completed"
                  ? CheckCircle2
                  : p.status === "delivered"
                    ? Clock
                    : Send;

              return (
                <Link
                  key={p.id}
                  href={`/project/${p.id}`}
                  className={cn(
                    "border-border bg-card flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-foreground/20",
                    needsYou && "ring-1 ring-foreground/10",
                  )}
                >
                  <Avatar
                    src={counterparty.image}
                    name={counterparty.name}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      with {counterparty.name}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium",
                      p.status === "completed"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        : p.status === "delivered"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {p.status === "delivered" && role === "client"
                      ? "Awaiting you"
                      : p.status === "delivered" && role === "creator"
                        ? "With client"
                        : p.status === "completed"
                          ? "Completed"
                          : p.status === "active"
                            ? "In progress"
                            : "Pending"}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-8 space-y-2">
        {conversations.length === 0 ? (
          <div className="border-border rounded-2xl border border-dashed py-16 text-center">
            <p className="text-muted-foreground text-sm">
              No conversations yet — open a post or creator profile to reach
              out.
            </p>
          </div>
        ) : (
          conversations.map((c) => {
            const otherId =
              c.participantA === currentUser.id
                ? c.participantB
                : c.participantA;
            const other = userMap.get(otherId);
            const last = lastByConv.get(c.id);
            const unread = unreadByConv.get(c.id) ?? 0;
            const isSender = last?.senderId === currentUser.id;
            const highMatch = (c.matchScore ?? 0) >= 0.8;

            return (
              <Link
                key={c.id}
                href={`/inbox/${c.id}`}
                className={cn(
                  "border-border bg-card flex items-center gap-4 rounded-xl border p-4 transition-colors hover:border-foreground/20",
                  highMatch && "ring-1 ring-foreground/10",
                )}
              >
                <Avatar src={other?.image} name={other?.name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{other?.name}</p>
                    <span className="text-muted-foreground text-xs">
                      {last
                        ? new Date(last.createdAt).toLocaleDateString()
                        : new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground truncate text-sm">
                    {last
                      ? `${isSender ? "You: " : ""}${last.content}`
                      : "No messages yet"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {c.matchScore != null && (
                    <MatchScoreBadge score={c.matchScore} size="sm" />
                  )}
                  {unread > 0 && (
                    <span className="bg-foreground text-background rounded-full px-2 py-0.5 text-[10px] font-medium">
                      {unread}
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
