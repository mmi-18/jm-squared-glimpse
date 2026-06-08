import { cn } from "@/lib/utils";

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function colorFromName(name?: string | null): string {
  if (!name) return "#1a1a1a";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const palette = [
    "#1a1a1a",
    "#2a2520",
    "#3a3a3a",
    "#555555",
    "#1f2937",
    "#374151",
  ];
  return palette[Math.abs(hash) % palette.length];
}

/**
 * Robust circular avatar — uses an Image when given a URL, falls back to
 * initials on a colored background otherwise.
 */
export function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      <div
        className={cn(
          "border-border relative shrink-0 overflow-hidden rounded-full border bg-muted",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {/* Plain <img>, not next/image — Next 16's image optimizer
         *  rejects nbg1.your-objectstorage.com + dicebear URLs at
         *  runtime even with the correct remotePatterns. See
         *  brief-matches-panel.tsx for the same workaround. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name ?? ""}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-border flex shrink-0 items-center justify-center rounded-full border font-medium text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: colorFromName(name),
        fontSize: size * 0.36,
      }}
    >
      {initials(name)}
    </div>
  );
}
