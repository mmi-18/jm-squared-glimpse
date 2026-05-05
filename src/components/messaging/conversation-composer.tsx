"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/upload";
import { sendMessage } from "@/components/messaging/actions";

/**
 * Conversation composer with text + file attachments.
 *
 * Files upload to Hetzner Object Storage as soon as you pick them
 * (via /api/upload → uploadFile() helper). The composer tracks each
 * pending upload optimistically with a local object-URL preview; once
 * the upload resolves, the row swaps to the real bucket URL and
 * becomes part of the next sent message. You can remove an attachment
 * before sending with the X button.
 *
 * The Send button is enabled when:
 *   - there's text content OR at least one uploaded attachment, AND
 *   - no upload is currently in flight (so we don't ship half-uploaded
 *     attachments by accident)
 */

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime";

type Pending = {
  id: string;
  status: "uploading" | "uploaded" | "error";
  /** Browser-side object URL; valid only until uploaded → revoked. */
  localPreview?: string;
  /** Bucket URL once /api/upload resolves. */
  url?: string;
  contentType?: string;
  error?: string;
};

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
  const [attachments, setAttachments] = useState<Pending[]>([]);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadingCount = attachments.filter(
    (a) => a.status === "uploading",
  ).length;
  const uploadedUrls = attachments
    .filter((a) => a.status === "uploaded" && a.url)
    .map((a) => a.url!);

  const canSend =
    !pending &&
    uploadingCount === 0 &&
    (content.trim().length > 0 || uploadedUrls.length > 0);

  function handlePickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const localPreview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;

      setAttachments((prev) => [
        ...prev,
        { id, status: "uploading", localPreview, contentType: file.type },
      ]);

      uploadFile(file)
        .then((res) => {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id
                ? {
                    ...a,
                    status: "uploaded",
                    url: res.url,
                    contentType: res.contentType,
                  }
                : a,
            ),
          );
        })
        .catch((err) => {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id
                ? {
                    ...a,
                    status: "error",
                    error:
                      err instanceof Error ? err.message : "Upload failed",
                  }
                : a,
            ),
          );
        });
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.localPreview) URL.revokeObjectURL(removed.localPreview);
      return prev.filter((a) => a.id !== id);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    const textToSend = content;
    const urlsToSend = [...uploadedUrls];
    startTransition(async () => {
      try {
        await sendMessage({
          recipientId,
          content: textToSend,
          matchScore,
          attachmentUrls: urlsToSend,
        });
        // Clean up local previews
        attachments.forEach((a) => {
          if (a.localPreview) URL.revokeObjectURL(a.localPreview);
        });
        setContent("");
        setAttachments([]);
        router.refresh();
      } catch {
        // Keep state intact; user can retry
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {/* Pending / uploaded attachment row */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => {
            const previewSrc = a.url ?? a.localPreview;
            const isImage = (a.contentType ?? "").startsWith("image/");
            return (
              <div
                key={a.id}
                className={cn(
                  "border-border bg-muted relative h-16 w-16 overflow-hidden rounded-lg border",
                  a.status === "error" && "border-destructive",
                )}
              >
                {isImage && previewSrc && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewSrc}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
                {!isImage && (
                  <div className="text-muted-foreground flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wider">
                    {a.contentType?.split("/")[1] ?? "file"}
                  </div>
                )}
                {a.status === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  </div>
                )}
                {a.status === "error" && (
                  <div
                    title={a.error}
                    className="text-destructive absolute inset-0 flex items-center justify-center bg-background/80 text-xs font-medium"
                  >
                    !
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  aria-label="Remove attachment"
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition-transform hover:scale-105"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => {
            handlePickFiles(e.target.files);
            // Reset so picking the same file again retriggers onChange.
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
          aria-label="Attach files"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a message…"
          className="flex-1"
          disabled={pending}
        />
        <Button
          type="submit"
          disabled={!canSend}
          size="icon"
          aria-label="Send message"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {uploadingCount > 0 && (
        <p className="text-muted-foreground text-xs">
          Uploading {uploadingCount} file{uploadingCount === 1 ? "" : "s"}…
        </p>
      )}
    </form>
  );
}
