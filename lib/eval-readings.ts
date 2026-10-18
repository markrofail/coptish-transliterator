import { scorePair } from "@/lib/eval-score";
import { lineText, mergedText, type Choices, type Merged, type Span } from "@/lib/merge-readings";

export type ReadingsScore = { spans: number; useful: number; noise: number; reachable: boolean };

// Index of the alternative that reading 1 gave (index 0 when reading 1 isn't merged).
function reading1Index(span: Span): number {
  const index = span.alternatives.findIndex((alternative) => alternative.readings.includes(1));
  return index === -1 ? 0 : index;
}

// Scores how useful the marks are against the gold text. A span is useful when choosing another
// alternative than reading 1's gets closer to the gold, and noise when reading 1's was already best.
export function scoreReadings(merged: Merged, gold: string): ReadingsScore {
  const goldLines = gold.split(/\r?\n/);
  const allSpans = merged.lines.flat().filter((token): token is Span => token.kind === "span");
  if (goldLines.length !== merged.lines.length) {
    return { spans: allSpans.length, useful: 0, noise: allSpans.length, reachable: scorePair(mergedText(merged, {}), gold).exact };
  }

  let useful = 0;
  let noise = 0;
  let reachable = true;
  merged.lines.forEach((line, lineIndex) => {
    const goldLine = goldLines[lineIndex];
    const best: Record<string, number> = {};
    for (const token of line) {
      if (token.kind !== "span") continue;
      const own = reading1Index(token);
      let bestIndex = own;
      let bestAccuracy = -1;
      token.alternatives.forEach((_, index) => {
        const choices: Choices = { [token.id]: index };
        const accuracy = scorePair(lineText(line, choices), goldLine).charAccuracy;
        const better = accuracy > bestAccuracy || (accuracy === bestAccuracy && index === own);
        if (better) {
          bestAccuracy = accuracy;
          bestIndex = index;
        }
      });
      best[token.id] = bestIndex;
      if (bestIndex === own) noise++;
      else useful++;
    }
    if (!scorePair(lineText(line, best), goldLine).exact) reachable = false;
  });
  return { spans: useful + noise, useful, noise, reachable };
}
