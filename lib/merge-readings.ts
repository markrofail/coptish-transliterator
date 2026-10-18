// Merges the Latin readings into one text, as defined in the spec (section 6): plain words where the
// readings agree, and spans to choose from where they don't.

import { READING_NUMBERS, type Reading } from "@/lib/readings";

export type Alternative = { text: string; readings: Reading[] }; // readings ascending
export type Span = { kind: "span"; id: string; alternatives: Alternative[] }; // alternatives[0] is the default
export type Token = { kind: "word"; text: string } | Span;
export type Merged = { lines: Token[][]; readings: Reading[] }; // readings: those merged, ascending
export type Choices = Readonly<Record<string, number>>; // span id → alternative index; missing = 0

type Run = { reading: Reading; words: string[] };

// Words are compared ignoring letter case and punctuation.
function key(word: string): string {
  return word.toLowerCase().replace(/\p{P}/gu, "");
}

// A run's words compared as a whole, leaving out punctuation-only words.
function runKey(words: readonly string[]): string {
  return words
    .map(key)
    .filter((wordKey) => wordKey !== "")
    .join(" ");
}

function splitWords(line: string): string[] {
  const trimmed = line.trim();
  return trimmed === "" ? [] : trimmed.split(/\s+/);
}

function plain(words: readonly string[]): Token[] {
  return words.map((text) => ({ kind: "word", text }));
}

// For each base word, the index of the other reading's word matched to it, or -1. Matches follow a
// longest common subsequence of keys, taken left to right so repeated words pair up in order.
function align(base: readonly string[], other: readonly string[]): number[] {
  // remaining[i][j] is the LCS length of base[i..] and other[j..].
  const remaining = Array.from({ length: base.length + 1 }, () => new Array<number>(other.length + 1).fill(0));
  for (let i = base.length - 1; i >= 0; i--) {
    for (let j = other.length - 1; j >= 0; j--) {
      remaining[i][j] =
        base[i] === other[j] ? remaining[i + 1][j + 1] + 1 : Math.max(remaining[i + 1][j], remaining[i][j + 1]);
    }
  }
  const matches = new Array<number>(base.length).fill(-1);
  let i = 0;
  let j = 0;
  while (i < base.length && j < other.length) {
    if (base[i] === other[j]) {
      // Equal keys always keep the LCS length, by the recurrence above.
      matches[i] = j;
      i++;
      j++;
    } else if (remaining[i + 1][j] > remaining[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return matches;
}

function agree(runs: readonly Run[]): boolean {
  const first = runKey(runs[0].words);
  return runs.every(({ words }) => runKey(words) === first);
}

function span(runs: readonly Run[], id: string): Span {
  const byKey = new Map<string, Alternative>();
  for (const { reading, words } of runs) {
    const alternativeKey = runKey(words);
    const alternative = byKey.get(alternativeKey);
    // Runs come in reading order, so each alternative keeps its lowest reading's text.
    if (alternative) alternative.readings.push(reading);
    else byKey.set(alternativeKey, { text: words.join(" "), readings: [reading] });
  }
  const alternatives = [...byKey.values()].sort(
    (a, b) => b.readings.length - a.readings.length || a.readings[0] - b.readings[0],
  );
  return { kind: "span", id, alternatives };
}

// The runs between two anchors: words if they agree, one span per word if every reading has the
// same number of words there, and otherwise one span for the whole run.
function mergeRegion(runs: readonly Run[], nextId: () => string): Token[] {
  if (agree(runs)) return plain(runs[0].words);
  const length = runs[0].words.length;
  if (!runs.every(({ words }) => words.length === length)) return [span(runs, nextId())];
  return Array.from({ length }, (_, position) =>
    runs.map(({ reading, words }) => ({ reading, words: [words[position]] })),
  ).flatMap((column) => (agree(column) ? plain(column[0].words) : [span(column, nextId())]));
}

function mergeLine(runs: readonly Run[], lineIndex: number): Token[] {
  const [base, ...others] = runs;
  const baseKeys = base.words.map(key);
  const matches = others.map(({ words }) => align(baseKeys, words.map(key)));
  // Anchors are the base words every other reading matched. Between them, each reading has its own region.
  const anchors = baseKeys.flatMap((_, index) => (matches.every((match) => match[index] !== -1) ? [index] : []));
  // Each reading's position of every anchor, between a start before the line and an end after it.
  const bounds = [
    runs.map(() => -1),
    ...anchors.map((anchor) => [anchor, ...matches.map((match) => match[anchor])]),
    runs.map(({ words }) => words.length),
  ];
  let spanCount = 0;
  const nextId = () => `${lineIndex}:${spanCount++}`;
  const line: Token[] = [];
  for (let k = 1; k < bounds.length; k++) {
    const regions = runs.map(({ reading, words }, r) => ({
      reading,
      words: words.slice(bounds[k - 1][r] + 1, bounds[k][r]),
    }));
    line.push(...mergeRegion(regions, nextId));
    if (k < bounds.length - 1) line.push({ kind: "word", text: base.words[anchors[k - 1]] });
  }
  return line;
}

export function mergeReadings(texts: Partial<Record<Reading, string>>, inputLineCount: number): Merged {
  const split = READING_NUMBERS.flatMap((reading) => {
    const text = texts[reading];
    return text === undefined ? [] : [{ reading, lines: text.split(/\r?\n/) }];
  });
  const kept = split.filter(({ lines }) => lines.length === inputLineCount);
  if (kept.length === 0) {
    // No reading lines up with the input, so show the lowest one as it came, with no marks.
    const [fallback] = split;
    return { lines: fallback.lines.map((line) => plain(splitWords(line))), readings: [fallback.reading] };
  }
  return {
    lines: Array.from({ length: inputLineCount }, (_, lineIndex) =>
      mergeLine(
        kept.map(({ reading, lines }) => ({ reading, words: splitWords(lines[lineIndex]) })),
        lineIndex,
      ),
    ),
    readings: kept.map(({ reading }) => reading),
  };
}

export function lineText(line: readonly Token[], choices: Choices): string {
  return line
    .map((token) => (token.kind === "word" ? token.text : token.alternatives[choices[token.id] ?? 0].text))
    .filter((text) => text !== "")
    .join(" ");
}

export function mergedText(merged: Merged, choices: Choices): string {
  return merged.lines.map((line) => lineText(line, choices)).join("\n");
}
