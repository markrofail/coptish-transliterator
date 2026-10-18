import { describe, expect, it } from "vitest";
import {
  beginPart,
  beginWalk,
  choose,
  finishWalk,
  hymnText,
  nextPart,
  partLoading,
  setAllOpen,
  settlePart,
  togglePart,
  type Walk,
} from "@/app/walk-through";
import type { Statuses } from "@/app/settle-readings";
import { mergeReadings } from "@/lib/merge-readings";
import type { Part } from "@/lib/split-parts";

const PARTS: Part[] = [
  { text: "ⲁ ⲃ\nⲅ", separator: "" },
  { text: "ⲇ\n\nⲉ", separator: "\n\n" },
  { text: "ⲍ", separator: " " },
];
const BACK: Statuses = { 1: "back", 2: "back", 3: "back" };
const WAITING: Statuses = { 1: "waiting", 2: "waiting", 3: "waiting" };

// Part 1's readings disagree on one word, so it has one span; the others agree.
const merged = [
  mergeReadings({ 1: "a b\nc", 2: "a v\nc", 3: "a b\nc" }, 2),
  mergeReadings({ 1: "d\n\ne", 2: "d\n\ne", 3: "d\n\ne" }, 3),
  mergeReadings({ 1: "z", 2: "z", 3: "z" }, 1),
];

function walkTo(index: number): Walk {
  let walk = beginPart(beginWalk("raw", PARTS), 0, [100]);
  for (let i = 0; i <= index; i++) {
    walk = settlePart(walk, i, { kind: "done", statuses: BACK, merged: merged[i] });
    if (i < index) walk = beginPart(nextPart(walk), i + 1, [100]);
  }
  return walk;
}

describe("beginWalk", () => {
  it("holds every part, none asked for yet, starting at part 1", () => {
    const walk = beginWalk("raw", PARTS);
    expect(walk.sentText).toBe("raw");
    expect(walk.current).toBe(0);
    expect(walk.finished).toBe(false);
    expect(walk.parts.map((p) => [p.lineCount, p.phase, p.open])).toEqual([
      [2, null, false],
      [3, null, false],
      [1, null, false],
    ]);
  });
});

describe("beginPart", () => {
  it("opens the part and loads it, with every reading waiting", () => {
    const walk = beginPart(beginWalk("raw", PARTS), 0, [100, 40]);
    expect(walk.parts[0].open).toBe(true);
    expect(walk.parts[0].phase).toEqual({ kind: "loading", rows: [100, 40], statuses: WAITING });
    expect(partLoading(walk)).toBe(true);
  });

  it("starts a retried part with fresh choices", () => {
    const chosen = choose(walkTo(0), 0, "0:0", 1);
    expect(chosen.parts[0].choices).toEqual({ "0:0": 1 });
    expect(beginPart(chosen, 0, [100]).parts[0].choices).toEqual({});
  });
});

describe("settlePart", () => {
  it("keeps the skeleton while readings come back", () => {
    const statuses: Statuses = { 1: "back", 2: "waiting", 3: "waiting" };
    const walk = settlePart(beginPart(beginWalk("raw", PARTS), 0, [100, 40]), 0, { kind: "waiting", statuses });
    expect(walk.parts[0].phase).toEqual({ kind: "loading", rows: [100, 40], statuses });
  });

  it("marks the part done, or failed", () => {
    const started = beginPart(beginWalk("raw", PARTS), 0, [100]);
    const done = settlePart(started, 0, { kind: "done", statuses: BACK, merged: merged[0] });
    expect(done.parts[0].phase).toEqual({ kind: "done", statuses: BACK, merged: merged[0] });
    expect(partLoading(done)).toBe(false);
    const failed = settlePart(started, 0, { kind: "error", message: "Too many requests.", retryable: true });
    expect(failed.parts[0].phase).toEqual({ kind: "error", message: "Too many requests.", retryable: true });
  });

  it("ignores an update for a part that isn't loading", () => {
    const walk = walkTo(0);
    expect(settlePart(walk, 0, { kind: "waiting", statuses: WAITING })).toEqual(walk);
    expect(settlePart(walk, 1, { kind: "done", statuses: BACK, merged: merged[1] })).toEqual(walk);
  });
});

describe("nextPart and finishWalk", () => {
  it("folds the part on screen and moves on, keeping its choices", () => {
    const walk = nextPart(choose(walkTo(0), 0, "0:0", 1));
    expect(walk.current).toBe(1);
    expect(walk.parts[0].open).toBe(false);
    expect(walk.parts[0].choices).toEqual({ "0:0": 1 });
    expect(walk.parts[1].phase).toBeNull();
  });

  it("folds the last part and finishes", () => {
    const walk = finishWalk(walkTo(2));
    expect(walk.finished).toBe(true);
    expect(walk.current).toBe(2);
    expect(walk.parts.map((p) => p.open)).toEqual([false, false, false]);
  });

  it("folds a part reopened along the way too: when all are done, every part is folded", () => {
    const reopened = togglePart(walkTo(2), 0);
    expect(reopened.parts.map((p) => p.open)).toEqual([true, false, true]);
    expect(finishWalk(reopened).parts.map((p) => p.open)).toEqual([false, false, false]);
  });
});

describe("togglePart and setAllOpen", () => {
  it("flips one part, or sets them all", () => {
    const walk = finishWalk(walkTo(2));
    expect(togglePart(walk, 1).parts.map((p) => p.open)).toEqual([false, true, false]);
    expect(togglePart(togglePart(walk, 1), 1).parts.map((p) => p.open)).toEqual([false, false, false]);
    const all = setAllOpen(walk, true);
    expect(all.parts.map((p) => p.open)).toEqual([true, true, true]);
    expect(setAllOpen(all, false).parts.map((p) => p.open)).toEqual([false, false, false]);
  });

  it("keeps choices through any number of folds", () => {
    let walk = finishWalk(choose(walkTo(2), 0, "0:0", 1));
    for (let i = 0; i < 3; i++) walk = setAllOpen(togglePart(walk, 0), false);
    expect(walk.parts[0].choices).toEqual({ "0:0": 1 });
  });
});

describe("hymnText", () => {
  it("copies part 1 alone, before part 2 is asked for", () => {
    expect(hymnText(walkTo(0).parts)).toBe("a b\nc");
  });

  it("joins every done part in order with its separator and choices", () => {
    const walk = choose(walkTo(2), 0, "0:0", 1);
    expect(hymnText(walk.parts)).toBe("a v\nc\n\nd\n\ne z");
  });

  it("leaves out a part that is still loading or failed", () => {
    const loading = beginPart(nextPart(walkTo(0)), 1, [100]);
    expect(hymnText(loading.parts)).toBe("a b\nc");
    const failed = settlePart(loading, 1, { kind: "error", message: "Down.", retryable: true });
    expect(hymnText(failed.parts)).toBe("a b\nc");
  });
});
