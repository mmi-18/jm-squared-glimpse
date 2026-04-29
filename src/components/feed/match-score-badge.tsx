import { cn } from "@/lib/utils";

export function MatchScoreBadge({
  score,
  size = "md",
  className,
}: {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const pct = Math.round(score * 100);
  const strong = pct >= 80;
  const sizeCls =
    size === "lg"
      ? "text-sm px-3 py-1.5 gap-2"
      : size === "md"
        ? "text-xs px-2.5 py-1 gap-1.5"
        : "text-[10px] px-2 py-0.5 gap-1";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium tracking-tight",
        strong
          ? "bg-[var(--match)] text-[var(--match-foreground)]"
          : "bg-foreground text-background",
        sizeCls,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
      {pct}% Match
    </span>
  );
}
