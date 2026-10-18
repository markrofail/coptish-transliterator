import { describe, expect, it } from "vitest";
import { lineText, mergedText, mergeReadings } from "@/lib/merge-readings";

const w = (text: string) => ({ kind: "word", text });

describe("mergeReadings", () => {
  it("keeps agreed words and blank lines", () => {
    const text = "Khen efran\n\nnem epsheeri";
    expect(mergeReadings({ 1: text, 2: text, 3: text }, 3)).toEqual({
      lines: [[w("Khen"), w("efran")], [], [w("nem"), w("epsheeri")]],
      readings: [1, 2, 3],
    });
  });

  it("marks a one-word disagreement, majority first", () => {
    const majority = "alla nahmen evolha pipethoou:";
    const merged = mergeReadings({ 1: "alla nahmen evolha pipethou:", 2: majority, 3: majority }, 1);
    expect(merged.lines).toEqual([
      [
        w("alla"),
        w("nahmen"),
        w("evolha"),
        {
          kind: "span",
          id: "0:0",
          alternatives: [
            { text: "pipethoou:", readings: [2, 3] },
            { text: "pipethou:", readings: [1] },
          ],
        },
      ],
    ]);
  });

  it("groups a split word into one span", () => {
    const merged = mergeReadings({ 1: "evol enneet e ouon", 2: "evol enneeete ouon", 3: "evol enneeete ouon" }, 1);
    expect(merged.lines).toEqual([
      [
        w("evol"),
        {
          kind: "span",
          id: "0:0",
          alternatives: [
            { text: "enneeete", readings: [2, 3] },
            { text: "enneet e", readings: [1] },
          ],
        },
        w("ouon"),
      ],
    ]);
  });

  it("records a left-out word as an empty alternative", () => {
    const full = "rasti meef nan emfoou:";
    const merged = mergeReadings({ 1: full, 2: "rasti meef emfoou:", 3: full }, 1);
    expect(merged.lines).toEqual([
      [
        w("rasti"),
        w("meef"),
        {
          kind: "span",
          id: "0:0",
          alternatives: [
            { text: "nan", readings: [1, 3] },
            { text: "", readings: [2] },
          ],
        },
        w("emfoou:"),
      ],
    ]);
  });

  it("ignores case and punctuation, showing reading 1's form", () => {
    const merged = mergeReadings(
      { 1: "nem Pipnevma Ethouab:", 2: "nem Pipnevma ethouab", 3: "nem pipnevma Ethouab:" },
      1,
    );
    expect(merged.lines).toEqual([[w("nem"), w("Pipnevma"), w("Ethouab:")]]);
  });

  it("combines alternatives that differ only in case or punctuation", () => {
    const merged = mergeReadings({ 1: "pipethou:", 2: "Pipethoou", 3: "pipethoou:" }, 1);
    expect(merged.lines).toEqual([
      [
        {
          kind: "span",
          id: "0:0",
          alternatives: [
            { text: "Pipethoou", readings: [2, 3] },
            { text: "pipethou:", readings: [1] },
          ],
        },
      ],
    ]);
  });

  it("splits neighbouring disagreements of equal length into one span per word", () => {
    const merged = mergeReadings(
      {
        1: "alla nahmen evolha pipethou:",
        2: "alla nahmen evolha pipethoou:",
        3: "alla nahmen ebolha pipethoou:",
      },
      1,
    );
    expect(merged.lines).toEqual([
      [
        w("alla"),
        w("nahmen"),
        {
          kind: "span",
          id: "0:0",
          alternatives: [
            { text: "evolha", readings: [1, 2] },
            { text: "ebolha", readings: [3] },
          ],
        },
        {
          kind: "span",
          id: "0:1",
          alternatives: [
            { text: "pipethoou:", readings: [2, 3] },
            { text: "pipethou:", readings: [1] },
          ],
        },
      ],
    ]);
  });

  it("orders a three-way tie by reading number", () => {
    const merged = mergeReadings({ 1: "ebol", 2: "evol", 3: "efol" }, 1);
    expect(merged.lines).toEqual([
      [
        {
          kind: "span",
          id: "0:0",
          alternatives: [
            { text: "ebol", readings: [1] },
            { text: "evol", readings: [2] },
            { text: "efol", readings: [3] },
          ],
        },
      ],
    ]);
  });

  it("numbers spans per line", () => {
    const other = "a X1 b Y1\nc Z1";
    const merged = mergeReadings({ 1: "a x b y\nc z", 2: other, 3: other }, 2);
    const ids = merged.lines.flat().flatMap((token) => (token.kind === "span" ? [token.id] : []));
    expect(ids).toEqual(["0:0", "0:1", "1:0"]);
  });

  it("uses the lowest reading present as the base", () => {
    expect(mergeReadings({ 2: "a x", 3: "a y" }, 1)).toEqual({
      lines: [
        [
          w("a"),
          {
            kind: "span",
            id: "0:0",
            alternatives: [
              { text: "x", readings: [2] },
              { text: "y", readings: [3] },
            ],
          },
        ],
      ],
      readings: [2, 3],
    });
  });

  it("returns a single reading as plain words", () => {
    expect(mergeReadings({ 1: "Amen" }, 1)).toEqual({ lines: [[w("Amen")]], readings: [1] });
  });

  it("leaves out a reading with the wrong line count", () => {
    expect(mergeReadings({ 1: "a\nb", 2: "a b", 3: "a\nc" }, 2)).toEqual({
      lines: [
        [w("a")],
        [
          {
            kind: "span",
            id: "1:0",
            alternatives: [
              { text: "b", readings: [1] },
              { text: "c", readings: [3] },
            ],
          },
        ],
      ],
      readings: [1, 3],
    });
  });

  it("falls back to the lowest reading, unmarked, when none has the right line count", () => {
    expect(mergeReadings({ 1: "a b c", 2: "a\nb\nc" }, 2)).toEqual({
      lines: [[w("a"), w("b"), w("c")]],
      readings: [1],
    });
  });

  it("marks a disagreement at the start of a line", () => {
    const merged = mergeReadings({ 1: "Khen efran", 2: "Ghen efran", 3: "Khen efran" }, 1);
    expect(merged.lines).toEqual([
      [
        {
          kind: "span",
          id: "0:0",
          alternatives: [
            { text: "Khen", readings: [1, 3] },
            { text: "Ghen", readings: [2] },
          ],
        },
        w("efran"),
      ],
    ]);
  });

  it("aligns repeated words left to right", () => {
    const merged = mergeReadings({ 1: "Amen Amen Amen", 2: "Amen Amen Amin", 3: "Amen Amen Amen" }, 1);
    expect(merged.lines).toEqual([
      [
        w("Amen"),
        w("Amen"),
        {
          kind: "span",
          id: "0:0",
          alternatives: [
            { text: "Amen", readings: [1, 3] },
            { text: "Amin", readings: [2] },
          ],
        },
      ],
    ]);
  });
});

describe("lineText and mergedText", () => {
  it("drops an empty choice without leaving a double space", () => {
    const [line] = mergeReadings({ 1: "a nan b", 2: "a b", 3: "a b" }, 1).lines;
    expect(lineText(line, {})).toBe("a b");
    expect(lineText(line, { "0:0": 1 })).toBe("a nan b");
  });

  it("joins lines with line breaks, using each choice", () => {
    const other = "a X1 b Y1\nc Z1";
    const merged = mergeReadings({ 1: "a x b y\nc z", 2: other, 3: other }, 2);
    expect(mergedText(merged, { "0:1": 1 })).toBe("a X1 b y\nc Z1");
  });
});
