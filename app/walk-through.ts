// The walk-through of a paste of more than one part (long-hymns spec, section 6), as pure steps:
// each takes the walk and returns the next one. Running the readings is left to the caller.

import type { PartPhase } from "@/app/part-body";
import type { Settled } from "@/app/settle-readings";
import { mergedText, type Choices } from "@/lib/merge-readings";
import { joinParts, type Part } from "@/lib/split-parts";

// phase is null until the reader asks for the part. The choices live here, so folding keeps them.
export type HymnPart = { part: Part; lineCount: number; phase: PartPhase | null; choices: Choices; open: boolean };
export type Walk = { sentText: string; parts: HymnPart[]; current: number; finished: boolean };

function withPart(walk: Walk, index: number, change: (part: HymnPart) => HymnPart): Walk {
  return { ...walk, parts: walk.parts.map((part, i) => (i === index ? change(part) : part)) };
}

/** A new walk-through of `parts`, split from `sentText`, on part 1. Nothing is fetched yet. */
export function beginWalk(sentText: string, parts: readonly Part[]): Walk {
  return {
    sentText,
    parts: parts.map((part) => ({
      part,
      lineCount: part.text.split("\n").length,
      phase: null,
      choices: {},
      open: false,
    })),
    current: 0,
    finished: false,
  };
}

/** Part `index` opens and loads. A retried part starts with fresh choices: failed or incomplete, it had no marks. */
export function beginPart(walk: Walk, index: number, rows: number[]): Walk {
  return withPart(walk, index, (part) => ({
    ...part,
    phase: { kind: "loading", rows, statuses: { 1: "waiting", 2: "waiting", 3: "waiting" } },
    choices: {},
    open: true,
  }));
}

export function settlePart(walk: Walk, index: number, settled: Settled): Walk {
  return withPart(walk, index, (part) => {
    if (part.phase?.kind !== "loading") return part;
    if (settled.kind === "waiting") return { ...part, phase: { ...part.phase, statuses: settled.statuses } };
    return { ...part, phase: settled };
  });
}

/** Folds the part on screen and moves on to the next one, which the caller then starts. */
export function nextPart(walk: Walk): Walk {
  return { ...withPart(walk, walk.current, (part) => ({ ...part, open: false })), current: walk.current + 1 };
}

/** Folds the last part, and any part reopened along the way, and shows the all-done state. */
export function finishWalk(walk: Walk): Walk {
  return { ...setAllOpen(walk, false), finished: true };
}

export function togglePart(walk: Walk, index: number): Walk {
  return withPart(walk, index, (part) => ({ ...part, open: !part.open }));
}

export function setAllOpen(walk: Walk, open: boolean): Walk {
  return { ...walk, parts: walk.parts.map((part) => ({ ...part, open })) };
}

export function choose(walk: Walk, index: number, spanId: string, chosenIndex: number): Walk {
  return withPart(walk, index, (part) => ({ ...part, choices: { ...part.choices, [spanId]: chosenIndex } }));
}

/** True while the part on screen is being fetched. */
export function partLoading(walk: Walk): boolean {
  return walk.parts[walk.current].phase?.kind === "loading";
}

/** What Copy all copies: every done part in order, with its choices, joined by the parts' separators. */
export function hymnText(parts: readonly HymnPart[]): string {
  return joinParts(
    parts.flatMap(({ part, phase, choices }) =>
      phase?.kind === "done" ? [{ separator: part.separator, text: mergedText(phase.merged, choices) }] : [],
    ),
  );
}
