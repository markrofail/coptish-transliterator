import { describe, expect, it } from "vitest";
import { SKELETON_MAX_ROWS, counterState, lineDelayMs, skeletonRows } from "@/app/view-helpers";

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
  it("stays hidden below 80% of the limit", () => {
    expect(counterState(a(3199)).visible).toBe(false);
  });

  it("shows a formatted count from 3,200", () => {
    expect(counterState(a(3200))).toEqual({ visible: true, over: false, label: "3,200 / 4,000" });
  });

  it("marks text over the limit", () => {
    expect(counterState(a(4001))).toEqual({ visible: true, over: true, label: "4,001 / 4,000" });
  });

  it("counts code points after trimming, combining marks included", () => {
    expect(counterState(`  ${"ⲛ̀".repeat(1600)}\n`).label).toBe("3,200 / 4,000");
  });
});

describe("lineDelayMs", () => {
  it("staggers lines by 40ms and caps at 480ms", () => {
    expect([0, 1, 12, 40].map(lineDelayMs)).toEqual([0, 40, 480, 480]);
  });
});
