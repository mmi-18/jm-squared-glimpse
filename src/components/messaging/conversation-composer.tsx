"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMessage } from "@/components/messaging/actions";

export function ConversationComposer({
  recipientId,
  matchScore,
}: {
  conversationId: string;
  recipientId: string;
  matchScore: number | null;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    startTransition(async () => {
      await sendMessage({ recipientId, content, matchScore });
      setContent("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a message…"
        className="flex-1"
      />
      <Button type="submit" disabled={pending || !content.trim()}>
        {pending ? "…" : "Send"}
      </Button>
    </form>
  );
}
