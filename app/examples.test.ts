import { describe, expect, it } from "vitest";
import { EXAMPLES } from "@/app/examples";
import reference from "@/data/reference.json";

describe("EXAMPLES", () => {
  it("has the four approved examples in order", () => {
    expect(EXAMPLES.map((e) => [e.id, e.title])).toEqual([
      ["risen", "Christ is risen"],
      ["name", "In the name of the Father"],
      ["prayer", "The Lord’s Prayer"],
      ["conclusion", "Through the intercessions"],
    ]);
  });

  it("copies every line exactly from data/reference.json", () => {
    const referenceLines = reference.flatMap((pair) => pair.coptic.split("\n"));
    for (const example of EXAMPLES) {
      for (const line of example.coptic.split("\n")) {
        expect(referenceLines, `${example.id}: ${line}`).toContain(line);
      }
    }
  });

  it("keeps each example's lines in reference order", () => {
    expect(EXAMPLES.map((e) => e.coptic.split("\n").length)).toEqual([2, 4, 7, 4]);
  });
});
