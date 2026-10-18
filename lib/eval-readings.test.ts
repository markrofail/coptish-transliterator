import { describe, expect, it } from "vitest";
import { scoreReadings } from "@/lib/eval-readings";
import { mergeReadings } from "@/lib/merge-readings";

describe("scoreReadings", () => {
  const merged = mergeReadings(
    { 1: "alla nahmen evolha pipethou:", 2: "alla nahmen evolha pipethoou:", 3: "alla nahmen ebolha pipethoou:" },
    1,
  );

  it("counts a span where reading 1 was wrong as useful and one where it was right as noise", () => {
    expect(scoreReadings(merged, "alla nahmen evolha pipethoou:")).toEqual({ spans: 2, useful: 1, noise: 1, reachable: true });
  });

  it("is unreachable when no choice gives the gold spelling", () => {
    expect(scoreReadings(merged, "alla nahmen evolha pipethooou:").reachable).toBe(false);
  });

  it("scores an unmarked result by exact match", () => {
    const single = mergeReadings({ 1: "Amen" }, 1);
    expect(scoreReadings(single, "Amen")).toEqual({ spans: 0, useful: 0, noise: 0, reachable: true });
    expect(scoreReadings(single, "Amin").reachable).toBe(false);
  });
});
