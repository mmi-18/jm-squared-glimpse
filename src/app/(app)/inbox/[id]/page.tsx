import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { MatchScoreBadge } from "@/components/feed/match-score-badge";
import { Avatar } from "@/components/brand/avatar";
import { ConversationComposer } from "@/components/messaging/conversation-composer";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const conv = await db.conversation.findUnique({ where: { id } });
  if (!conv) notFound();

  if (
    conv.participantA !== currentUser.id &&
    conv.participantB !== currentUser.id
  ) {
    redirect("/inbox");
  }

  const otherId =
    conv.participantA === currentUser.id
      ? conv.participantB
      : conv.participantA;

  const [otherUser, messages] = await Promise.all([
    db.user.findUnique({
      where: { id: otherId },
      select: { id: true, name: true, image: true, userType: true },
    }),
    db.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!otherUser) notFound();

  // Mark incoming as read
  await db.message.updateMany({
    where: {
      conversationId: id,
      receiverId: currentUser.id,
      read: false,
    },
    data: { read: true },
  });

  const profileHref =
    otherUser.userType === "creator"
      ? `/creator/${otherUser.id}`
      : `/startup/${otherUser.id}`;

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 py-4 md:h-[calc(100vh-4rem)] md:px-6">
      <div className="border-border mb-4 flex items-center justify-between gap-3 border-b pb-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/inbox"
            aria-label="Back to inbox"
            className="text-muted-foreground hover:text-foreground inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {/* Same pill-shape affordance as TopNav profile link — was
              previously plain text with hover:opacity-80, which read as
              decoration. Now obviously clickable: rounded background on
              hover + larger padding + min-h-[44px] hit target. */}
          <Link
            href={profileHref}
            aria-label="View profile"
            className="hover:bg-muted inline-flex min-h-[44px] min-w-0 items-center gap-3 rounded-full pl-1 pr-3 transition-colors"
          >
            <Avatar src={otherUser.image} name={otherUser.name} size={36} />
            <span className="text-foreground truncate font-medium">
              {otherUser.name}
            </span>
          </Link>
        </div>
        {conv.matchScore != null && (
          <MatchScoreBadge
            score={conv.matchScore}
            size="md"
            className="shrink-0"
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-center text-sm">
            No messages yet.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const mine = m.senderId === currentUser.id;
              const hasText = m.content.trim().length > 0;
              const hasAttachments = m.attachmentUrls.length > 0;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
                >
                  {hasText && (
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        mine
                          ? "bg-foreground text-background"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {m.content}
                    </div>
                  )}
                  {hasAttachments && (
                    <div
                      className={`grid max-w-[280px] gap-1 ${
                        m.attachmentUrls.length === 1
                          ? "grid-cols-1"
                          : "grid-cols-2"
                      }`}
                    >
                      {m.attachmentUrls.map((url, i) => {
                        const isVideo = /\.(mp4|mov)(\?|$)/i.test(url);
                        return (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border-border bg-muted relative block aspect-square overflow-hidden rounded-xl border transition-opacity hover:opacity-90"
                          >
                            {isVideo ? (
                              /* Inline video preview, click to open in
                                 new tab for full-screen native controls */
                              <video
                                src={url}
                                className="h-full w-full object-cover"
                                muted
                                playsInline
                              />
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={url}
                                alt={`Attachment ${i + 1}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            )}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-border border-t pt-4">
        <ConversationComposer
          conversationId={id}
          recipientId={otherId}
          matchScore={conv.matchScore}
        />
      </div>
    </div>
  );
}
