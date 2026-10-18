import { describe, expect, it } from "vitest";
import { levenshtein, normalize, scorePair, summarize } from "@/lib/eval-score";

describe("normalize", () => {
  it("trims, collapses whitespace and ignores case", () => {
    expect(normalize("  Khen   efran\n emefyot ")).toBe("khen efran emefyot");
  });
});

describe("levenshtein", () => {
  it("counts single-character edits", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("thok", "thok")).toBe(0);
    expect(levenshtein("thok", "thoak")).toBe(1);
    expect(levenshtein("ebol", "evol")).toBe(1);
    expect(levenshtein("nte", "ente")).toBe(1);
    expect(levenshtein("abc", "")).toBe(3);
  });
});

describe("scorePair", () => {
  it("is an exact match when only case and spacing differ", () => {
    expect(scorePair("Khen  Efran", "khen efran")).toEqual({ exact: true, charAccuracy: 1 });
  });

  it("scores per-character accuracy against the expected text", () => {
    const score = scorePair("Je thoak te tigom", "Je thok te tigom");
    expect(score.exact).toBe(false);
    expect(score.charAccuracy).toBeCloseTo(1 - 1 / "je thok te tigom".length);
  });

  it("never scores below zero", () => {
    expect(scorePair("a completely different and much longer answer", "ab").charAccuracy).toBe(0);
  });
});

describe("summarize", () => {
  it("reports the exact-match rate and mean character accuracy", () => {
    const summary = summarize([
      { exact: true, charAccuracy: 1 },
      { exact: false, charAccuracy: 0.9 },
    ]);
    expect(summary.exactRate).toBe(0.5);
    expect(summary.meanCharAccuracy).toBeCloseTo(0.95);
  });

  it("handles an empty run", () => {
    expect(summarize([])).toEqual({ exactRate: 0, meanCharAccuracy: 0 });
  });
});
