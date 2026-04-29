"use client";

import { cn } from "@/lib/utils";

export function ChipGroup({
  options,
  value,
  onChange,
  allowMultiple = true,
  formatLabel,
}: {
  options: { value: string; label: string }[] | readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  allowMultiple?: boolean;
  formatLabel?: (s: string) => string;
}) {
  const normalized = (Array.isArray(options) ? options : Array.from(options)).map(
    (o) =>
      typeof o === "string"
        ? { value: o, label: formatLabel ? formatLabel(o) : humanize(o) }
        : o,
  );

  function toggle(v: string) {
    const has = value.includes(v);
    if (allowMultiple) {
      onChange(has ? value.filter((x) => x !== v) : [...value, v]);
    } else {
      onChange(has ? [] : [v]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {normalized.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              active
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-foreground border-border hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function humanize(s: string) {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
