"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { LayoutGroup, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  type CellSpan,
  type Columns,
  type GridCell,
  SPAN_TO_COLS_ROWS,
  pickSpan,
} from "@/components/grid/types";

export type SpanGridProps<T> = {
  cells: GridCell<T>[];
  /** Column count per breakpoint. Defaults to { base: 2, md: 4, lg: 6 }. */
  columns?: Columns;
  /** Toggle edit affordances (resize handles, keyboard). */
  editable?: boolean;
  /** Called when the user changes a cell's span. Required when editable. */
  onCellsChange?: (next: GridCell<T>[]) => void;
  /** Render the cell content. */
  renderCell: (cell: GridCell<T>) => React.ReactNode;
  /** Gap between cells in px. */
  gap?: number;
  className?: string;
};

const DEFAULT_COLUMNS: Columns = { base: 2, md: 4, lg: 6 };

// Tailwind classes for the known column counts. Listed so the JIT picks them up.
// If you pass a column count outside this set, fall back to inline style.
const GRID_COLS_CLASSES: Record<string, string> = {
  "base-1": "grid-cols-1",
  "base-2": "grid-cols-2",
  "base-3": "grid-cols-3",
  "md-2": "md:grid-cols-2",
  "md-3": "md:grid-cols-3",
  "md-4": "md:grid-cols-4",
  "lg-4": "lg:grid-cols-4",
  "lg-5": "lg:grid-cols-5",
  "lg-6": "lg:grid-cols-6",
};

function resolveGridClasses(cols: Columns): string {
  const parts = [GRID_COLS_CLASSES[`base-${cols.base}`] ?? "grid-cols-2"];
  if (cols.md) parts.push(GRID_COLS_CLASSES[`md-${cols.md}`] ?? "md:grid-cols-4");
  if (cols.lg) parts.push(GRID_COLS_CLASSES[`lg-${cols.lg}`] ?? "lg:grid-cols-6");
  return parts.join(" ");
}

/**
 * Active-column-count hook. Mirrors the Tailwind breakpoints we render.
 * Used to compute the square row height in pixels (CSS alone can't align
 * row-spans to column width when `grid-auto-rows: auto`).
 */
function useActiveColumnCount(cols: Columns): number {
  const [n, setN] = useState<number>(cols.base);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (cols.lg && w >= 1024) setN(cols.lg);
      else if (cols.md && w >= 768) setN(cols.md);
      else setN(cols.base);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [cols.base, cols.md, cols.lg]);
  return n;
}

export function SpanGrid<T>({
  cells,
  columns = DEFAULT_COLUMNS,
  editable = false,
  onCellsChange,
  renderCell,
  gap = 8,
  className,
}: SpanGridProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeCols = useActiveColumnCount(columns);
  const [rowHeight, setRowHeight] = useState<number>(0);

  // Keep grid-auto-rows equal to column width so 2×2 and 1×2 line up square.
  // Guard against ResizeObserver loops: skip updates < 0.5px, and throttle
  // via requestAnimationFrame so the ResizeObserver callback completes before
  // layout reads happen again.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const compute = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth;
        if (w === 0) return;
        const rh = (w - gap * (activeCols - 1)) / activeCols;
        setRowHeight((prev) => (Math.abs(prev - rh) < 0.5 ? prev : rh));
      });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [activeCols, gap]);

  const setSpan = useCallback(
    (id: string, span: CellSpan) => {
      if (!onCellsChange) return;
      onCellsChange(
        cells.map((c) => (c.id === id ? { ...c, span } : c)),
      );
    },
    [cells, onCellsChange],
  );

  /**
   * Reorder by moving the cell at `fromIndex` to `toIndex` (insert-before).
   * Triggered by drag-to-reorder gesture in `SpanGridCell`.
   */
  const reorder = useCallback(
    (fromId: string, toId: string) => {
      if (!onCellsChange || fromId === toId) return;
      const next = [...cells];
      const fromIndex = next.findIndex((c) => c.id === fromId);
      const toIndex = next.findIndex((c) => c.id === toId);
      if (fromIndex === -1 || toIndex === -1) return;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      onCellsChange(next);
    },
    [cells, onCellsChange],
  );

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  return (
    <LayoutGroup>
      <div
        ref={containerRef}
        className={cn(
          "grid w-full",
          resolveGridClasses(columns),
          className,
        )}
        style={{
          gap,
          gridAutoFlow: "dense",
          gridAutoRows: rowHeight ? `${rowHeight}px` : undefined,
        }}
      >
        {cells.map((cell) => (
          <SpanGridCell
            key={cell.id}
            cell={cell}
            editable={editable}
            onSpanChange={(span) => setSpan(cell.id, span)}
            rowHeight={rowHeight}
            isDragging={draggingId === cell.id}
            isDropTarget={dropTargetId === cell.id && draggingId !== cell.id}
            onDragStart={() => setDraggingId(cell.id)}
            onDragOverCell={setDropTargetId}
            onDrop={(targetId) => {
              setDraggingId(null);
              setDropTargetId(null);
              if (targetId && targetId !== cell.id) reorder(cell.id, targetId);
            }}
          >
            {renderCell(cell)}
          </SpanGridCell>
        ))}
      </div>
    </LayoutGroup>
  );
}

function SpanGridCell<T>({
  cell,
  editable,
  onSpanChange,
  rowHeight,
  children,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOverCell,
  onDrop,
}: {
  cell: GridCell<T>;
  editable: boolean;
  onSpanChange: (span: CellSpan) => void;
  rowHeight: number;
  children: React.ReactNode;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragOverCell: (id: string | null) => void;
  onDrop: (targetId: string | null) => void;
}) {
  const { cols, rows } = SPAN_TO_COLS_ROWS[cell.span];
  const [previewSpan, setPreviewSpan] = useState<CellSpan | null>(null);
  const cellRef = useRef<HTMLDivElement | null>(null);

  // Long-press → drag-to-reorder state. Skips when the pointer started on
  // an interactive child (resize handle, button, textarea, link).
  const pressTimer = useRef<number | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const [pressing, setPressing] = useState(false);

  const displayed = previewSpan ?? cell.span;
  const { cols: dCols, rows: dRows } = SPAN_TO_COLS_ROWS[displayed];

  function pointerOnInteractive(e: React.PointerEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement;
    return !!t.closest(
      '[data-noreorder], textarea, input, button, a, [role="slider"], [role="menuitem"]',
    );
  }

  function onPointerDownReorder(e: React.PointerEvent<HTMLDivElement>) {
    if (!editable) return;
    if (pointerOnInteractive(e)) return;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setPressing(true);
    pressTimer.current = window.setTimeout(() => {
      onDragStart();
      cellRef.current?.setPointerCapture?.(e.pointerId);
    }, 280);
  }

  function onPointerMoveReorder(e: React.PointerEvent<HTMLDivElement>) {
    if (!editable) return;
    // Cancel pending long-press if pointer drifts before threshold
    if (pressing && !isDragging && dragStartPos.current) {
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);
      if (dx + dy > 8) {
        if (pressTimer.current) {
          window.clearTimeout(pressTimer.current);
          pressTimer.current = null;
        }
        setPressing(false);
      }
      return;
    }
    if (!isDragging) return;
    // Find the cell currently under the pointer
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = (el as HTMLElement | null)?.closest("[data-cell-id]");
    const id = target?.getAttribute("data-cell-id") ?? null;
    onDragOverCell(id);
  }

  function endReorder() {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setPressing(false);
    dragStartPos.current = null;
  }

  function onPointerUpReorder(e: React.PointerEvent<HTMLDivElement>) {
    if (isDragging) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = (el as HTMLElement | null)?.closest("[data-cell-id]");
      const id = target?.getAttribute("data-cell-id") ?? null;
      onDrop(id);
    }
    endReorder();
  }

  function onPointerCancelReorder() {
    if (isDragging) onDrop(null);
    endReorder();
  }

  return (
    <motion.div
      ref={cellRef}
      data-cell-id={cell.id}
      layout
      transition={{ type: "spring", damping: 28, stiffness: 260, mass: 0.9 }}
      className={cn(
        "relative overflow-hidden",
        editable && "select-none",
        isDragging && "z-30 scale-[1.04] opacity-80 shadow-2xl",
        isDropTarget &&
          "ring-foreground rounded-2xl ring-2 ring-offset-2 ring-offset-background",
      )}
      style={{
        gridColumn: `span ${dCols} / span ${dCols}`,
        gridRow: `span ${dRows} / span ${dRows}`,
        touchAction: editable ? "none" : undefined,
      }}
      onPointerDown={onPointerDownReorder}
      onPointerMove={onPointerMoveReorder}
      onPointerUp={onPointerUpReorder}
      onPointerCancel={onPointerCancelReorder}
      // Keyboard a11y fallback (non-touch, no hover)
      tabIndex={editable ? 0 : -1}
      onKeyDown={
        editable
          ? (e) => {
              if (e.key === "1") onSpanChange("1x1");
              else if (e.key === "2") onSpanChange("2x1");
              else if (e.key === "3") onSpanChange("1x2");
              else if (e.key === "4") onSpanChange("2x2");
            }
          : undefined
      }
    >
      <motion.div layout="position" className="h-full w-full">
        {children}
      </motion.div>

      {editable && !isDragging && (
        <ResizeHandle
          cellRef={cellRef}
          currentSpan={cell.span}
          rowHeight={rowHeight}
          onPreview={setPreviewSpan}
          onCommit={(next) => {
            setPreviewSpan(null);
            if (next !== cell.span) onSpanChange(next);
          }}
        />
      )}
    </motion.div>
  );
}

/**
 * Bottom-right drag handle. On pointer down, captures the starting cell size.
 * As the user drags, computes target span from offset (> half-cell → span 2).
 * Snaps on release. Large hit area (44×44) for touch; visible handle is 16×16.
 */
function ResizeHandle({
  cellRef,
  currentSpan,
  rowHeight,
  onPreview,
  onCommit,
}: {
  cellRef: React.RefObject<HTMLDivElement | null>;
  currentSpan: CellSpan;
  rowHeight: number;
  onPreview: (span: CellSpan | null) => void;
  onCommit: (span: CellSpan) => void;
}) {
  const start = useRef<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!cellRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = cellRef.current.getBoundingClientRect();
    start.current = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }

  function computeTarget(dx: number, dy: number): CellSpan {
    if (!start.current) return currentSpan;
    // base 1-cell width/height (row height is square with column width)
    const baseW = rowHeight || start.current.w;
    const baseH = rowHeight || start.current.w;
    // Current span in base units
    const { cols, rows } = SPAN_TO_COLS_ROWS[currentSpan];
    // Target width/height in pixels
    const targetW = start.current.w + dx;
    const targetH = start.current.h + dy;
    // Decide: wider = target > 1.5 * baseW; taller = target > 1.5 * baseH
    const wide = targetW > baseW * 1.5;
    const tall = targetH > baseH * 1.5;
    void cols;
    void rows;
    return pickSpan(wide, tall);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    onPreview(computeTarget(dx, dy));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    const target = computeTarget(dx, dy);
    start.current = null;
    onCommit(target);
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
  }

  function onPointerCancel() {
    start.current = null;
    onPreview(null);
  }

  return (
    <div
      role="slider"
      aria-label="Resize cell"
      aria-valuetext={currentSpan}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      // 44×44 touch target; visible handle is the inner element
      className="group absolute bottom-0 right-0 flex h-11 w-11 cursor-se-resize items-end justify-end p-1 touch-none"
    >
      <ResizeHandleVisual />
    </div>
  );
}

const ResizeHandleVisual = forwardRef<HTMLDivElement>(function ResizeHandleVisual(
  _props,
  ref,
) {
  return (
    <div
      ref={ref}
      aria-hidden
      className="bg-foreground group-active:scale-110 relative h-5 w-5 rounded-md ring-2 ring-white/90 shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform"
    >
      <span className="absolute bottom-1 right-1 flex flex-col items-end gap-[1.5px]">
        <span className="block h-[2px] w-2 rounded-full bg-background" />
        <span className="block h-[2px] w-3 rounded-full bg-background" />
      </span>
    </div>
  );
});
