// Scores the held-out reference pairs against real Gemini calls, for several setups.
// Run with `npm run eval`. Needs GEMINI_API_KEY in .env.local; every pair is one API call.
import { ThinkingLevel } from "@google/genai";
import reference from "@/data/reference.json";
import { scorePair, summarize, type PairScore } from "@/lib/eval-score";
import { transliterate, type GeminiConfig } from "@/lib/gemini";
import type { ReferencePair } from "@/lib/prompt";

const SETUPS: { name: string; config: GeminiConfig }[] = [
  { name: "gemini-3.8-flash low", config: { model: "gemini-3.8-flash", thinkingLevel: ThinkingLevel.LOW } },
  { name: "gemini-3.5-flash-lite minimal", config: { model: "gemini-3.5-flash-lite", thinkingLevel: ThinkingLevel.MINIMAL } },
  { name: "gemini-3.5-flash-lite low", config: { model: "gemini-3.5-flash-lite", thinkingLevel: ThinkingLevel.LOW } },
];

// Spaces calls out to stay under free-tier requests-per-minute limits (gemini-3.8-flash hit 429s at ~7/min).
const DELAY_MS = 13000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  process.loadEnvFile(".env.local");
  console.info = () => {}; // transliterate() logs one line per call; keep the report readable.

  const heldout = (reference as ReferencePair[]).filter((pair) => pair.split === "heldout");
  // `npm run eval -- lite` runs only the setups whose name contains "lite".
  const filter = process.argv[2];
  const setups = filter ? SETUPS.filter((setup) => setup.name.includes(filter)) : SETUPS;
  const rows: Record<string, string>[] = [];

  for (const setup of setups) {
    console.log(`\n=== ${setup.name}`);
    const scores: PairScore[] = [];
    for (const pair of heldout) {
      const result = await transliterate(pair.coptic, setup.config);
      const actual = result.ok ? result.latin : `[${result.code}]`;
      const score = scorePair(actual, pair.latin);
      scores.push(score);
      console.log(`${score.exact ? "✓" : "✗"} ${(score.charAccuracy * 100).toFixed(1)}%  ${pair.latin.slice(0, 40)}`);
      if (!score.exact) console.log(`    expected: ${pair.latin}\n    actual:   ${actual}`);
      await sleep(DELAY_MS);
    }
    const summary = summarize(scores);
    rows.push({
      setup: setup.name,
      "exact match": `${Math.round(summary.exactRate * 100)}%`,
      "char accuracy": `${(summary.meanCharAccuracy * 100).toFixed(1)}%`,
    });
  }

  console.log();
  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
