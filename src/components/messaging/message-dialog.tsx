"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MatchScoreBadge } from "@/components/feed/match-score-badge";
import { sendMessage } from "@/components/messaging/actions";

export function MessageDialog({
  recipientId,
  recipientName,
  matchScore,
  isAuthenticated,
  trigger,
}: {
  recipientId: string;
  recipientName: string;
  matchScore: number | null;
  isAuthenticated: boolean;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onTriggerClick() {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setOpen(true);
  }

  function submit() {
    if (!content.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await sendMessage({ recipientId, content, matchScore });
        setOpen(false);
        setContent("");
        router.push("/inbox");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send");
      }
    });
  }

  return (
    <>
      <span onClick={onTriggerClick} className="inline-flex cursor-pointer">
        {trigger}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              Message {recipientName}
              {matchScore != null && (
                <MatchScoreBadge score={matchScore} size="sm" />
              )}
            </DialogTitle>
            <DialogDescription>
              {matchScore != null
                ? "Your match score reflects style, industry, and working fit."
                : "Start a conversation directly."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={5}
            placeholder="Hey — loved your work. I'm working on a project and would love to talk."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !content.trim()}>
              {pending ? "Sending…" : "Send message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
