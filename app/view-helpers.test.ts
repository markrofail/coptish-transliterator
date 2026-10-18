import { mergeReadings, spanCount } from "@/lib/merge-readings";
import { describe, expect, it } from "vitest";
import {
  SKELETON_MAX_ROWS,
  counterState,
  foldedLabel,
  lineDelayMs,
  readingsBackLabel,
  readingsNote,
  skeletonRows,
} from "@/app/view-helpers";

const a = (n: number) => "ⲁ".repeat(n);

describe("skeletonRows", () => {
  it("gives one bar per line, as wide as the line relative to the longest", () => {
    expect(skeletonRows(`${a(20)}\n${a(10)}`, 50)).toEqual([100, 50]);
  });

  it("gives a blank row for a blank line", () => {
    expect(skeletonRows(`${a(2)}\n\n${a(2)}`, 50)).toEqual([100, 0, 100]);
  });

  it("never draws a bar narrower than 28%", () => {
    expect(skeletonRows(`${a(20)}\n${a(1)}`, 50)).toEqual([100, 28]);
  });

  // Review Focus 2
  it("wraps a line longer than a row into full bars and a shorter one", () => {
    expect(skeletonRows(a(120), 50)).toEqual([100, 100, 40]);
  });

  // Review Focus 3
  it("ignores Windows line endings and blank lines around the text", () => {
    expect(skeletonRows(`\r\n ${a(4)}\r\n${a(2)} \r\n\r\n`, 50)).toEqual([100, 50]);
  });

  it("stops at 40 rows", () => {
    expect(skeletonRows(`${a(1)}\n`.repeat(60), 50)).toHaveLength(SKELETON_MAX_ROWS);
  });
});

describe("counterState", () => {
  it("stays hidden up to 4,000", () => {
    expect(counterState(a(4000))).toEqual({ visible: false, over: false, label: "4,000 / 16,000", parts: 1 });
  });

  it("shows the count and parts above 4,000", () => {
    const state = counterState(a(9000));
    expect(state.visible).toBe(true);
    expect(state.over).toBe(false);
    expect(state.label).toBe("9,000 / 16,000 · 3 parts");
    expect(state.parts).toBe(3);
  });

  it("marks text over 16,000, with no parts suffix", () => {
    const state = counterState(a(16001));
    expect(state.visible).toBe(true);
    expect(state.over).toBe(true);
    expect(state.label).toBe("16,001 / 16,000");
  });

  it("counts code points after trimming, combining marks included", () => {
    expect(counterState(`  ${"ⲛ̀".repeat(2500)}\n`).label).toBe("5,000 / 16,000 · 2 parts");
  });
});

describe("foldedLabel", () => {
  const same = (text: string) => mergeReadings({ 1: text, 2: text, 3: text }, text.split("\n").length);

  it("counts chosen spans in stanzas", () => {
    const text = "a b\n\nc d\n\ne f";
    const other = "a X1\n\nc Y1\n\ne f";
    const merged = mergeReadings({ 1: "a x\n\nc y\n\ne f", 2: other, 3: other }, 5);
    expect(spanCount(merged)).toBe(2);
    expect(foldedLabel(text, merged, 1)).toBe("3 stanzas · 1 of 2 chosen");
  });

  it("says all agree for lines with no spans", () => {
    const text = "a b\nc d\ne f\ng h";
    expect(foldedLabel(text, same(text), 0)).toBe("4 lines · all agree");
  });

  it("names the words and readings that came back", () => {
    const text = "a b c d e";
    expect(foldedLabel(text, mergeReadings({ 1: text, 3: text }, 1), 0)).toBe(
      "5 words · 2 of 3 readings came back",
    );
  });

  it("uses the singular for a single line and word", () => {
    expect(foldedLabel("a", same("a"), 0)).toBe("1 word · all agree");
    expect(foldedLabel("a b", same("a b"), 0)).toBe("2 words · all agree");
  });

  it("warns when lines may be missing", () => {
    const text = "a b\nc d";
    const merged = mergeReadings({ 1: "a b", 2: "a b", 3: "a b" }, 2);
    expect(foldedLabel(text, merged, 0)).toBe("2 lines · lines may be missing");
  });
});

describe("lineDelayMs", () => {
  it("staggers lines by 40ms and caps at 480ms", () => {
    expect([0, 1, 12, 40].map(lineDelayMs)).toEqual([0, 40, 480, 480]);
  });
});

describe("readingsBackLabel", () => {
  it("counts the readings that came back", () => {
    expect(readingsBackLabel({ 1: "back", 2: "waiting", 3: "failed" })).toBe("1 of 3 back");
  });
});

describe("readingsNote", () => {
  it("says what the reader can do with the readings", () => {
    expect(readingsNote(3, 0, 0)).toBe("All 3 readings agree");
    expect(readingsNote(3, 2, 0)).toBe("2 words where the readings disagree · tap one to choose");
    expect(readingsNote(3, 1, 0)).toBe("1 word where the readings disagree · tap it to choose");
    expect(readingsNote(3, 2, 1)).toBe("1 of 2 chosen");
    expect(readingsNote(2, 1, 0)).toBe("2 of 3 readings came back · 1 word where the readings disagree · tap it to choose");
    expect(readingsNote(2, 2, 1)).toBe("2 of 3 readings came back · 1 of 2 chosen");
    expect(readingsNote(2, 0, 0)).toBe("2 of 3 readings came back · they agree");
    expect(readingsNote(1, 0, 0)).toBe("1 of 3 readings came back");
  });
});
