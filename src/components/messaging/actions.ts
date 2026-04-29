"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * Send a message. Creates the conversation lazily on the first message and
 * keeps `lastMessageAt` fresh on subsequent ones. Conversations are keyed
 * on the sorted (participantA, participantB) pair so reaching out to the
 * same person twice doesn't fork the thread.
 */
export async function sendMessage(args: {
  recipientId: string;
  content: string;
  matchScore: number | null;
}) {
  const user = await requireUser();
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
      content: args.content,
      matchScore: args.matchScore,
    },
  });

  revalidatePath("/inbox");
  return { conversationId: conversation.id };
}
