// Scores the held-out reference pairs against real Gemini calls, for several setups.
// Run with `npm run eval`. Needs GEMINI_API_KEY in .env.local; every pair is one API call.
import { ThinkingLevel } from "@google/genai";
import reference from "@/data/reference.json";
import { scorePair, summarize, type PairScore } from "@/lib/eval-score";
import { scoreReadings } from "@/lib/eval-readings";
import { READINGS, SAMPLED_TEMPERATURE, transliterate, type GeminiConfig } from "@/lib/gemini";
import { mergedText, mergeReadings, type Span } from "@/lib/merge-readings";
import { READING_NUMBERS, type Reading } from "@/lib/readings";
import type { ReferencePair } from "@/lib/prompt";

const SETUPS: { name: string; config: GeminiConfig }[] = [
  { name: "gemini-3.8-flash low", config: { model: "gemini-3.8-flash", thinkingLevel: ThinkingLevel.LOW, temperature: 0 } },
  { name: "gemini-3.5-flash-lite minimal", config: { model: "gemini-3.5-flash-lite", thinkingLevel: ThinkingLevel.MINIMAL, temperature: 0 } },
  { name: "gemini-3.5-flash-lite low", config: { model: "gemini-3.5-flash-lite", thinkingLevel: ThinkingLevel.LOW, temperature: 0 } },
];

// Spaces calls out to stay under free-tier requests-per-minute limits (gemini-3.8-flash hit 429s at ~7/min).
const DELAY_MS = 13000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// `npm run eval -- three [temperature]` does what the app does: three readings per pair, merged.
async function runThree(heldout: ReferencePair[], temperature: number) {
  console.log(`\n=== three readings, sampled temperature ${temperature}`);
  const configs: Record<Reading, GeminiConfig> = {
    1: READINGS[1],
    2: { ...READINGS[2], temperature },
    3: { ...READINGS[3], temperature },
  };
  const reading1Scores: PairScore[] = [];
  const mergedScores: PairScore[] = [];
  let spans = 0;
  let lines = 0;
  let useful = 0;
  let noise = 0;
  let reachable = 0;

  for (const pair of heldout) {
    const texts: Partial<Record<Reading, string>> = {};
    for (const reading of READING_NUMBERS) {
      const result = await transliterate(pair.coptic, configs[reading], reading);
      if (result.ok) texts[reading] = result.latin;
      else console.log(`    reading ${reading} failed: ${result.code}`);
      await sleep(DELAY_MS);
    }
    const inputLineCount = pair.coptic.split(/\r?\n/).length;
    const merged = mergeReadings(texts, inputLineCount);
    const defaultText = mergedText(merged, {});
    const score = scoreReadings(merged, pair.latin);

    reading1Scores.push(scorePair(texts[1] ?? "", pair.latin));
    mergedScores.push(scorePair(defaultText, pair.latin));
    spans += score.spans;
    lines += merged.lines.length;
    useful += score.useful;
    noise += score.noise;
    if (score.reachable) reachable++;

    console.log(`\ngold:     ${pair.latin}\nreading 1: ${texts[1] ?? "(failed)"}\nmerged:    ${defaultText}`);
    for (const span of merged.lines.flat().filter((token): token is Span => token.kind === "span")) {
      console.log(`    span: ${span.alternatives.map((a) => `"${a.text}" (${a.readings.length} of ${merged.readings.length})`).join(" | ")}`);
    }
  }

  const reading1 = summarize(reading1Scores);
  const mergedSummary = summarize(mergedScores);
  console.log();
  console.table([
    {
      temperature,
      "reading 1 exact": `${Math.round(reading1.exactRate * 100)}%`,
      "reading 1 chars": `${(reading1.meanCharAccuracy * 100).toFixed(1)}%`,
      "merged exact": `${Math.round(mergedSummary.exactRate * 100)}%`,
      "merged chars": `${(mergedSummary.meanCharAccuracy * 100).toFixed(1)}%`,
      "spans/line": (spans / lines).toFixed(2),
      useful,
      noise,
      reachable: `${Math.round((reachable / heldout.length) * 100)}%`,
    },
  ]);
}

async function main() {
  process.loadEnvFile(".env.local");
  console.info = () => {}; // transliterate() logs one line per call; keep the report readable.

  const heldout = (reference as ReferencePair[]).filter((pair) => pair.split === "heldout");
  if (process.argv[2] === "three") {
    const temperature = process.argv[3] === undefined ? SAMPLED_TEMPERATURE : Number(process.argv[3]);
    if (!Number.isFinite(temperature)) throw new Error(`Bad temperature: ${process.argv[3]}`);
    await runThree(heldout, temperature);
    return;
  }
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
