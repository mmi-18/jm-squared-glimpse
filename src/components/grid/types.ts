export type CellSpan = "1x1" | "2x1" | "1x2" | "2x2";

export type GridCell<T = unknown> = {
  id: string;
  span: CellSpan;
  data: T;
};

export type Columns = {
  /** Column count at the base (smallest) breakpoint. Required. */
  base: number;
  /** Column count from Tailwind's `md` breakpoint (≥768px). */
  md?: number;
  /** Column count from Tailwind's `lg` breakpoint (≥1024px). */
  lg?: number;
};

export const SPAN_TO_COLS_ROWS: Record<CellSpan, { cols: 1 | 2; rows: 1 | 2 }> =
  {
    "1x1": { cols: 1, rows: 1 },
    "2x1": { cols: 2, rows: 1 },
    "1x2": { cols: 1, rows: 2 },
    "2x2": { cols: 2, rows: 2 },
  };

export function pickSpan(wide: boolean, tall: boolean): CellSpan {
  if (wide && tall) return "2x2";
  if (wide) return "2x1";
  if (tall) return "1x2";
  return "1x1";
}
