import { MAX_INPUT_LENGTH, MAX_PASTE_LENGTH } from "@/lib/validate";
import { isIncomplete, spanCount, type Merged } from "@/lib/merge-readings";
import { splitParts } from "@/lib/split-parts";
import type { Statuses } from "@/app/settle-readings";
import { READING_NUMBERS } from "@/lib/readings";

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

export type CounterState = { visible: boolean; over: boolean; label: string; parts: number };

export function counterState(text: string): CounterState {
  const trimmed = text.trim();
  const length = [...trimmed].length;
  const over = length > MAX_PASTE_LENGTH;
  const parts = over ? 1 : splitParts(trimmed).length;
  const count = `${length.toLocaleString("en-US")} / ${MAX_PASTE_LENGTH.toLocaleString("en-US")}`;
  return {
    visible: length > MAX_INPUT_LENGTH,
    over,
    label: parts > 1 ? `${count} · ${parts} parts` : count,
    parts,
  };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** The text of a folded part's row, without the "Part N · " prefix. */
export function foldedLabel(partText: string, merged: Merged, chosen: number): string {
  const trimmed = partText.trim();
  const stanzas = trimmed.split(/\n\s*\n/).length;
  const lineCount = trimmed.split(/\r?\n/).length;
  let size: string;
  if (stanzas > 1) size = plural(stanzas, "stanza");
  else if (lineCount > 1) size = plural(lineCount, "line");
  else size = plural(trimmed.split(/\s+/).filter(Boolean).length, "word");

  const spans = spanCount(merged);
  let summary: string;
  if (isIncomplete(merged, lineCount)) summary = "lines may be missing";
  else if (spans > 0) summary = `${chosen} of ${spans} chosen`;
  else if (merged.readings.length === 3) summary = "all agree";
  else summary = `${merged.readings.length} of 3 readings came back`;
  return `${size} · ${summary}`;
}

export function lineDelayMs(index: number): number {
  return Math.min(index * 40, 480);
}

export function readingsBackLabel(statuses: Statuses): string {
  const back = READING_NUMBERS.filter((reading) => statuses[reading] === "back").length;
  return `${back} of 3 back`;
}

/** The note under the output: what the reader can do with the readings. */
export function readingsNote(mergedCount: number, spans: number, chosen: number): string {
  if (mergedCount === 1) return "1 of 3 readings came back";
  const prefix = mergedCount === 2 ? "2 of 3 readings came back · " : "";
  if (spans === 0) return mergedCount === 2 ? `${prefix}they agree` : "All 3 readings agree";
  if (chosen > 0) return `${prefix}${chosen} of ${spans} chosen`;
  const disagree =
    spans === 1
      ? "1 word where the readings disagree · tap it to choose"
      : `${spans} words where the readings disagree · tap one to choose`;
  return prefix + disagree;
}
