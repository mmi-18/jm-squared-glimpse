"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileIcon, Loader2, Send, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { uploadFile } from "@/lib/upload";
import { submitDelivery } from "@/app/(app)/project/actions";
import { cn } from "@/lib/utils";

type Pending =
  | { id: string; status: "uploading"; name: string; sizeBytes: number }
  | {
      id: string;
      status: "uploaded";
      name: string;
      sizeBytes: number;
      url: string;
      contentType: string;
    }
  | {
      id: string;
      status: "error";
      name: string;
      sizeBytes: number;
      error: string;
    };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Creator-only inline form on /project/<id> when status=active.
 *
 * Lets the creator stage one or more files (each upload fires the
 * moment the file is picked, so by the time they hit Submit the
 * bytes are already in the bucket) plus an optional note, then
 * submits the delivery — which atomically creates a Delivery row
 * and flips status active → delivered.
 *
 * Mirrors the messaging composer's pending-tile pattern: each file
 * gets a row that flips uploading → uploaded → error. Submit is
 * disabled while any upload is in flight.
 */
export function DeliverySubmitForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<Pending[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const anyUploading = files.some((f) => f.status === "uploading");
  const uploaded = files.filter(
    (f): f is Extract<Pending, { status: "uploaded" }> =>
      f.status === "uploaded",
  );
  const canSubmit =
    !anyUploading && (uploaded.length > 0 || message.trim().length > 0);

  async function handleFiles(picked: File[]) {
    setError(null);
    if (picked.length === 0) return;

    const newPending: Pending[] = picked.map((file) => ({
      id: crypto.randomUUID(),
      status: "uploading" as const,
      name: file.name,
      sizeBytes: file.size,
    }));
    setFiles((prev) => [...prev, ...newPending]);

    // Fire uploads in parallel
    await Promise.all(
      picked.map(async (file, idx) => {
        const id = newPending[idx]!.id;
        try {
          const res = await uploadFile(file);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? {
                    id,
                    status: "uploaded" as const,
                    name: file.name,
                    sizeBytes: file.size,
                    url: res.url,
                    contentType: res.contentType,
                  }
                : f,
            ),
          );
        } catch (e) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? {
                    id,
                    status: "error" as const,
                    name: file.name,
                    sizeBytes: file.size,
                    error: e instanceof Error ? e.message : "Upload failed",
                  }
                : f,
            ),
          );
        }
      }),
    );
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    startSubmit(async () => {
      try {
        await submitDelivery({
          projectId,
          message: message.trim() || undefined,
          files: uploaded.map((f) => ({
            name: f.name,
            url: f.url,
            sizeBytes: f.sizeBytes,
            contentType: f.contentType,
          })),
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to submit");
      }
    });
  }

  return (
    <section className="border-border bg-card overflow-hidden rounded-2xl border">
      <header className="border-border bg-muted/40 border-b px-4 py-3">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.12em]">
          Submit delivery
        </p>
        <p className="mt-0.5 text-sm font-medium">
          Upload your finished work — the client signs off from here
        </p>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        {/* File picker */}
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) =>
              handleFiles(Array.from(e.target.files ?? []))
            }
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={submitting}
            className={cn(
              "border-border hover:border-foreground/30 hover:bg-muted/40",
              "flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed",
              "px-6 py-8 text-sm transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            <Upload className="text-muted-foreground h-6 w-6" />
            <span className="font-medium">Add files</span>
            <span className="text-muted-foreground text-xs">
              Up to 50&nbsp;MB each. Bigger raws? Drop a link in the
              note below.
            </span>
          </button>
        </div>

        {/* Pending file tiles */}
        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((f) => (
              <li
                key={f.id}
                className={cn(
                  "border-border flex items-center gap-3 rounded-lg border p-3",
                  f.status === "error" &&
                    "border-destructive/40 bg-destructive/5",
                )}
              >
                {f.status === "uploading" ? (
                  <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <FileIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {f.status === "uploading" && "Uploading…"}
                    {f.status === "uploaded" && formatSize(f.sizeBytes)}
                    {f.status === "error" && (
                      <span className="text-destructive">{f.error}</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  disabled={submitting}
                  aria-label={`Remove ${f.name}`}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Optional note */}
        <div>
          <label
            htmlFor={`delivery-message-${projectId}`}
            className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wider"
          >
            Note (optional)
          </label>
          <Textarea
            id={`delivery-message-${projectId}`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Anything the client needs to know? Files in different formats, links to large raws, instructions for re-export, …"
            rows={3}
            disabled={submitting}
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>

      <footer className="border-border flex items-center justify-end gap-2 border-t px-4 py-3 sm:px-5">
        {anyUploading && (
          <p className="text-muted-foreground mr-auto inline-flex items-center gap-1.5 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" /> Uploading
            {files.filter((f) => f.status === "uploading").length} file
            {files.filter((f) => f.status === "uploading").length === 1
              ? ""
              : "s"}
            …
          </p>
        )}
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {submitting ? "Submitting…" : "Submit delivery"}
        </Button>
      </footer>
    </section>
  );
}

