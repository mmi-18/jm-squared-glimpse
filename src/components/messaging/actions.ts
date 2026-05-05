"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * Send a message. Creates the conversation lazily on the first message and
 * keeps `lastMessageAt` fresh on subsequent ones. Conversations are keyed
 * on the sorted (participantA, participantB) pair so reaching out to the
 * same person twice doesn't fork the thread.
 *
 * `attachmentUrls` are absolute URLs returned by `/api/upload` — bucket
 * links to images/videos uploaded by this user. Stored on the message;
 * the conversation page renders them as inline tiles below the text.
 *
 * Either content or attachments must be non-empty (or both); empty
 * messages are rejected to keep the thread clean.
 */
export async function sendMessage(args: {
  recipientId: string;
  content: string;
  matchScore: number | null;
  attachmentUrls?: string[];
}) {
  const user = await requireUser();
  const content = args.content.trim();
  const attachments = (args.attachmentUrls ?? []).filter(
    (u) => typeof u === "string" && u.length > 0,
  );
  if (content.length === 0 && attachments.length === 0) {
    throw new Error("Message must have text or at least one attachment");
  }

  const [a, b] = [user.id, args.recipientId].sort();
  const now = new Date();

  // Ensure conversation exists (sorted-pair invariant: a <= b lexicographically)
  const conversation = await db.conversation.upsert({
    where: { participantA_participantB: { participantA: a, participantB: b } },
    create: {
      participantA: a,
      participantB: b,
      matchScore: args.matchScore,
      lastMessageAt: now,
    },
    update: { lastMessageAt: now },
  });

  await db.message.create({
    data: {
      conversationId: conversation.id,
      senderId: user.id,
      receiverId: args.recipientId,
      content,
      attachmentUrls: attachments,
      matchScore: args.matchScore,
    },
  });

  revalidatePath("/inbox");
  revalidatePath(`/inbox/${conversation.id}`);
  return { conversationId: conversation.id };
}
