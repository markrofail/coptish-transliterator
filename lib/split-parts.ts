import { MAX_INPUT_LENGTH } from "@/lib/validate";

export type Separator = "" | " " | "\n" | "\n\n";
// separator: the whitespace removed before this part; "" for the first part and after a hard cut.
export type Part = { text: string; separator: Separator };

type Run = { start: number; end: number; kind: "blank" | "line" | "punct" | "space" };

const KINDS: Run["kind"][] = ["blank", "line", "punct", "space"];
const SEPARATORS: Record<Run["kind"], Separator> = {
  blank: "\n\n",
  line: "\n",
  punct: " ",
  space: " ",
};
// How far from the even-split target a cut may sit and still be preferred over a better kind of break.
const NEAR = 1000;

function classify(cps: string[], start: number, end: number): Run["kind"] {
  const newlines = cps.slice(start, end).filter((c) => c === "\n").length;
  if (newlines >= 2) return "blank";
  if (newlines === 1) return "line";
  return [":", ".", "·"].includes(cps[start - 1]) ? "punct" : "space";
}

// Whitespace runs that begin inside (from, from + max].
function runsIn(cps: string[], from: number, max: number): Run[] {
  const runs: Run[] = [];
  const last = Math.min(from + max, cps.length - 1);
  for (let i = from + 1; i <= last; i++) {
    if (!/\s/.test(cps[i]) || /\s/.test(cps[i - 1])) continue;
    let end = i;
    while (end < cps.length && /\s/.test(cps[end])) end++;
    runs.push({ start: i, end, kind: classify(cps, i, end) });
  }
  return runs;
}

function closest(runs: Run[], target: number): Run | undefined {
  let best: Run | undefined;
  for (const r of runs) {
    if (!best || Math.abs(r.start - target) < Math.abs(best.start - target)) best = r;
  }
  return best;
}

// Picks the cut among whitespace runs near the target (within NEAR); only if no run at all sits
// near the target does it look across the whole range. It takes the best kind of break whose cut
// leaves the rest fitting in the remaining parts (so no extra part is forced), and the one closest
// to the target within that kind. If no run lets the rest fit, it ignores that and takes the best kind.
function chooseCut(runs: Run[], target: number, maxRest: number, total: number): Run | undefined {
  const pick = (pool: Run[]): Run | undefined => {
    const fitting = pool.filter((r) => total - r.end <= maxRest);
    for (const candidates of [fitting, pool]) {
      for (const kind of KINDS) {
        const best = closest(
          candidates.filter((r) => r.kind === kind),
          target,
        );
        if (best) return best;
      }
    }
    return undefined;
  };
  const near = runs.filter((r) => Math.abs(r.start - target) <= NEAR);
  return near.length > 0 ? pick(near) : pick(runs);
}

// Splits validated, trimmed text into parts of at most MAX_INPUT_LENGTH code points, cutting at
// whitespace (preferring stanza breaks, then lines, then after : . ·, then any space).
export function splitParts(text: string): Part[] {
  const cps = [...text.replace(/\r\n/g, "\n")];
  const parts: Part[] = [];
  let start = 0;
  let separator: Separator = "";

  while (cps.length - start > MAX_INPUT_LENGTH) {
    const remaining = cps.length - start;
    const count = Math.ceil(remaining / MAX_INPUT_LENGTH);
    const target = start + Math.round(remaining / count);
    const cut = chooseCut(runsIn(cps, start, MAX_INPUT_LENGTH), target, (count - 1) * MAX_INPUT_LENGTH, cps.length);
    if (!cut) {
      parts.push({ text: cps.slice(start, start + MAX_INPUT_LENGTH).join(""), separator });
      start += MAX_INPUT_LENGTH;
      separator = "";
      continue;
    }
    parts.push({ text: cps.slice(start, cut.start).join(""), separator });
    start = cut.end;
    separator = SEPARATORS[cut.kind];
  }
  parts.push({ text: cps.slice(start).join(""), separator });
  return parts;
}

export function joinParts(pieces: readonly { separator: Separator; text: string }[]): string {
  return pieces.map((p) => p.separator + p.text).join("");
}
