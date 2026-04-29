"use client";

import { STYLE_DIMENSIONS } from "@/lib/constants";
import type { StyleVector } from "@/lib/types";

/**
 * Simple SVG radar chart of the 7 style dimensions.
 */
export function StyleRadar({ vector }: { vector: StyleVector }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 32;
  const dims = STYLE_DIMENSIONS;
  const n = dims.length;

  function point(i: number, value: number) {
    const norm = Math.max(0, Math.min(1, (value - 1) / 9));
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = radius * norm;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const;
  }

  const values = dims.map((d) => vector[d.key] ?? 5);
  const polygon = values
    .map((v, i) => point(i, v))
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0].map((t) => {
    const pts: string[] = [];
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = radius * t;
      pts.push(`${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`);
    }
    return pts.join(" ");
  });

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        ))}
        {dims.map((_, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          );
        })}
        <polygon
          points={polygon}
          fill="currentColor"
          fillOpacity={0.08}
          stroke="currentColor"
          strokeWidth={1.5}
        />
        {dims.map((d, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          const r = radius + 14;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          return (
            <text
              key={d.key}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
