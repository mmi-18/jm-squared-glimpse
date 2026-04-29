"use client";

import { Slider } from "@/components/ui/slider";

function firstNumber(v: number | readonly number[] | undefined, fallback: number): number {
  if (Array.isArray(v)) return v[0] ?? fallback;
  if (typeof v === "number") return v;
  return fallback;
}

export function StyleSlider({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground text-sm">{value} / 10</span>
      </div>
      <Slider
        min={1}
        max={10}
        step={1}
        value={[value]}
        onValueChange={(v) => onChange(firstNumber(v, 5))}
      />
      <div className="text-muted-foreground mt-3 flex justify-between text-xs">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
