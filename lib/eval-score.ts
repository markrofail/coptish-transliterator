// Scoring for scripts/eval.ts, as defined in the spec (section 9).

export type PairScore = { exact: boolean; charAccuracy: number };

export type RunSummary = { exactRate: number; meanCharAccuracy: number };

export function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function levenshtein(a: string, b: string): number {
  const source = [...a];
  const target = [...b];
  let previous = Array.from({ length: target.length + 1 }, (_, i) => i);
  for (let i = 1; i <= source.length; i++) {
    const current = [i];
    for (let j = 1; j <= target.length; j++) {
      const substitution = previous[j - 1] + (source[i - 1] === target[j - 1] ? 0 : 1);
      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, substitution));
    }
    previous = current;
  }
  return previous[target.length];
}

export function scorePair(actual: string, expected: string): PairScore {
  const got = normalize(actual);
  const want = normalize(expected);
  const length = [...want].length;
  const charAccuracy = length === 0 ? (got === "" ? 1 : 0) : Math.max(0, 1 - levenshtein(got, want) / length);
  return { exact: got === want, charAccuracy };
}

export function summarize(scores: readonly PairScore[]): RunSummary {
  if (scores.length === 0) return { exactRate: 0, meanCharAccuracy: 0 };
  return {
    exactRate: scores.filter((score) => score.exact).length / scores.length,
    meanCharAccuracy: scores.reduce((sum, score) => sum + score.charAccuracy, 0) / scores.length,
  };
}
