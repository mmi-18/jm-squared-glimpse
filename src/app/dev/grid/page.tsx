"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { SpanGrid } from "@/components/grid/span-grid";
import type { CellSpan, GridCell } from "@/components/grid/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DemoData = { label: string; tone: number };

const PALETTE = [
  "bg-foreground text-background",
  "bg-warm text-foreground",
  "bg-muted text-foreground",
  "bg-[#ff6b5a] text-white",
  "bg-[#1f2937] text-white",
  "bg-[#374151] text-white",
  "bg-[#2a2520] text-white",
];

function makeCell(i: number, span: CellSpan = "1x1"): GridCell<DemoData> {
  return {
    id: `cell-${i}-${Math.random().toString(36).slice(2, 7)}`,
    span,
    data: { label: String(i), tone: i % PALETTE.length },
  };
}

const INITIAL: GridCell<DemoData>[] = [
  makeCell(1, "1x1"),
  makeCell(2, "2x1"),
  makeCell(3, "1x1"),
  makeCell(4, "1x2"),
  makeCell(5, "1x1"),
  makeCell(6, "1x1"),
  makeCell(7, "2x2"),
  makeCell(8, "1x1"),
  makeCell(9, "2x1"),
  makeCell(10, "1x1"),
  makeCell(11, "1x1"),
  makeCell(12, "1x1"),
];

export default function GridDemoPage() {
  const [cells, setCells] = useState<GridCell<DemoData>[]>(INITIAL);
  const [editable, setEditable] = useState(true);
  const [counter, setCounter] = useState(13);

  return (
    <div
      className="bg-background min-h-screen"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <header className="border-border bg-background/95 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link
              href="/"
              className="text-muted-foreground text-xs hover:underline"
            >
              ← dev
            </Link>
            <h1 className="text-lg font-medium leading-tight">
              Cell-Spanning Grid
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="border-border inline-flex overflow-hidden rounded-lg border text-xs">
              <button
                type="button"
                onClick={() => setEditable(false)}
                className={cn(
                  "px-3 py-1.5 transition-colors",
                  !editable
                    ? "bg-foreground text-background"
                    : "hover:bg-muted",
                )}
              >
                Read-only
              </button>
              <button
                type="button"
                onClick={() => setEditable(true)}
                className={cn(
                  "px-3 py-1.5 transition-colors",
                  editable
                    ? "bg-foreground text-background"
                    : "hover:bg-muted",
                )}
              >
                Editable
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setCells((c) => [...c, makeCell(counter)]);
              setCounter((n) => n + 1);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Cell
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCells((c) => c.slice(0, -1));
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove last
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCells(INITIAL);
              setCounter(13);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>

          <div className="text-muted-foreground ml-auto text-[11px] leading-tight">
            <div>{cells.length} cells</div>
            <div>breakpoints: base&nbsp;2 · md&nbsp;4 · lg&nbsp;6</div>
          </div>
        </div>

        {editable && (
          <p className="text-muted-foreground mb-4 text-xs leading-relaxed">
            Drag the handle in the bottom-right corner of any cell to resize —
            snap to 1×1, 2×1, 1×2, or 2×2 on release. Tap a cell and press
            <kbd className="border-border bg-muted mx-1 rounded border px-1">1</kbd>
            /
            <kbd className="border-border bg-muted mx-1 rounded border px-1">2</kbd>
            /
            <kbd className="border-border bg-muted mx-1 rounded border px-1">3</kbd>
            /
            <kbd className="border-border bg-muted mx-1 rounded border px-1">4</kbd>
            as a keyboard fallback.
          </p>
        )}

        <SpanGrid
          cells={cells}
          editable={editable}
          onCellsChange={setCells}
          renderCell={(cell) => (
            <DemoTile label={cell.data.label} tone={cell.data.tone} span={cell.span} />
          )}
        />

        <section className="mt-10">
          <h2 className="text-sm font-medium">Current state</h2>
          <pre className="border-border bg-muted/40 mt-2 overflow-x-auto rounded-xl border p-3 text-[11px] leading-relaxed">
            {JSON.stringify(
              cells.map((c) => ({ id: c.id.slice(-5), span: c.span, label: c.data.label })),
              null,
              2,
            )}
          </pre>
        </section>
      </main>
    </div>
  );
}

function DemoTile({
  label,
  tone,
  span,
}: {
  label: string;
  tone: number;
  span: CellSpan;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center rounded-xl",
        PALETTE[tone % PALETTE.length],
      )}
    >
      <span className="text-4xl font-medium">{label}</span>
      <span className="absolute left-2 top-2 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/90">
        {span}
      </span>
    </div>
  );
}
