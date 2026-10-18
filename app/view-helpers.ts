import { MAX_INPUT_LENGTH } from "@/lib/validate";

export const SKELETON_MAX_ROWS = 40;

const MIN_BAR_PERCENT = 28;

/** Bar widths in percent, one per output row; 0 is a blank row. */
export function skeletonRows(text: string, charsPerRow: number): number[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => [...line.trim()].length);
  const perRow = Math.max(1, charsPerRow);
  const widest = Math.min(Math.max(...lines, 1), perRow);
  const rows: number[] = [];
  for (const length of lines) {
    if (length === 0) {
      rows.push(0);
    } else {
      // A line too long for one row wraps into full bars and a shorter last one.
      const fullRows = Math.floor((length - 1) / perRow);
      for (let i = 0; i < fullRows; i++) rows.push(100);
      const rest = length - fullRows * perRow;
      rows.push(Math.max(MIN_BAR_PERCENT, Math.min(100, Math.round((rest / widest) * 100))));
    }
    if (rows.length >= SKELETON_MAX_ROWS) break;
  }
  return rows.slice(0, SKELETON_MAX_ROWS);
}

export type CounterState = { visible: boolean; over: boolean; label: string };

export function counterState(text: string): CounterState {
  const length = [...text.trim()].length;
  return {
    visible: length >= MAX_INPUT_LENGTH * 0.8,
    over: length > MAX_INPUT_LENGTH,
    label: `${length.toLocaleString("en-US")} / ${MAX_INPUT_LENGTH.toLocaleString("en-US")}`,
  };
}

export function lineDelayMs(index: number): number {
  return Math.min(index * 40, 480);
}
