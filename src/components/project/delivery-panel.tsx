import { Download, FileIcon, FileText, Image as ImageIcon, Music, Package, Video } from "lucide-react";

/**
 * Read-only delivery viewer rendered on /project/<id> once status
 * has progressed past `active`. Both parties see the same content —
 * the file manifest the creator submitted and the optional note.
 *
 * Files are rendered as a clickable list; clicking opens the bucket
 * URL in a new tab (browsers handle the download / preview based
 * on Content-Type from the bucket). Image previews collapse to a
 * thumbnail strip when there are 1-3 images.
 *
 * No edit affordances here — once `submitDelivery` runs the manifest
 * is immutable. Revisions (Chunk G) will create a new Delivery row
 * rather than mutating this one.
 */

export type DeliveryFile = {
  name: string;
  url: string;
  sizeBytes: number;
  contentType: string;
};

export type DeliverySnapshot = {
  id: string;
  message: string | null;
  files: DeliveryFile[];
  createdAt: Date;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function iconForType(
  contentType: string,
): React.ComponentType<{ className?: string }> {
  if (contentType.startsWith("image/")) return ImageIcon;
  if (contentType.startsWith("video/")) return Video;
  if (contentType.startsWith("audio/")) return Music;
  if (contentType === "application/pdf") return FileText;
  if (contentType.includes("zip")) return Package;
  return FileIcon;
}

export function DeliveryPanel({
  delivery,
  viewerRole,
}: {
  delivery: DeliverySnapshot | null;
  viewerRole: "client" | "creator";
}) {
  if (!delivery) return null;

  const imageFiles = delivery.files.filter((f) =>
    f.contentType.startsWith("image/"),
  );

  return (
    <section className="border-border bg-card mt-6 overflow-hidden rounded-2xl border">
      <header className="border-border bg-muted/40 flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.12em]">
            Delivery
          </p>
          <p className="mt-0.5 text-sm font-medium">
            {viewerRole === "client"
              ? "Submitted for your review"
              : "Submitted to client"}
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          {formatDate(delivery.createdAt)}
        </p>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        {delivery.message && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">
              Note from creator
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {delivery.message}
            </p>
          </div>
        )}

        {/* Image previews — collapsed thumbnail strip when 1-3 */}
        {imageFiles.length > 0 && imageFiles.length <= 3 && (
          <div className="flex flex-wrap gap-2">
            {imageFiles.map((f) => (
              <a
                key={f.url}
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="border-border block overflow-hidden rounded-lg border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.url}
                  alt={f.name}
                  className="block max-h-48 w-auto"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}

        {/* File list */}
        {delivery.files.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">
            No files attached — see the note above.
          </p>
        ) : (
          <ul className="space-y-2">
            {delivery.files.map((f) => {
              const Icon = iconForType(f.contentType);
              return (
                <li key={f.url}>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    download={f.name}
                    className="border-border hover:border-foreground/30 hover:bg-muted/40 flex items-center gap-3 rounded-lg border p-3 transition-colors"
                  >
                    <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatSize(f.sizeBytes)}
                      </p>
                    </div>
                    <Download className="text-muted-foreground h-4 w-4 shrink-0" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
