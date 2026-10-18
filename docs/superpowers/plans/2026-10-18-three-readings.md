# Three Readings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every transliteration runs three Gemini readings at once. The page shows one merged text, where the reader can choose between the versions wherever the readings disagree.

**Architecture:**
- **Server:** a reading number (1, 2 or 3) picks one of three settings, and the API gains an optional `reading` field.
- **Browser:** sends three requests in parallel. A pure "settle" module turns their results into what the page shows.
- **Merging:** `lib/merge-readings.ts`, a pure module, aligns the readings word by word into plain words and choosable spans.
- **Evaluation:** a new eval mode runs the same pipeline against the held-out pairs, to tune the temperature for readings 2 and 3.

**Tech Stack:** Next.js 16.4.2 (App Router), React 19.3.1, TypeScript 5, Tailwind CSS 4, `@google/genai` 2.30, Vitest 4 (node environment, no DOM), `tsx` for scripts, Node 20.19.2.

**Spec:** `docs/superpowers/specs/2026-10-18-three-readings-design.md`, plus its approved mockup `docs/superpowers/specs/2026-10-18-three-readings-states.html`. Read both. Section numbers below refer to that spec.

## Global Constraints

- **Branch:** work on `three-readings`. It already exists, with the spec committed.
- **Readings:**
  - Reading 1 is exactly today's settings: `gemini-3.5-flash-lite`, `ThinkingLevel.LOW`, temperature 0.
  - Readings 2 and 3 are the same, at `SAMPLED_TEMPERATURE`. That's 1 until Task 5 tunes it.
- **API:** `POST /api/transliterate` with `{ "text": string, "reading"?: 1 | 2 | 3 }`.
  - A missing `reading` means 1.
  - Any other value is a 400 `invalid_input` with the message `reading must be 1, 2 or 3.`
- **Straggler cut-off:** `STRAGGLER_MS = 10000`, measured from when the first reading came back. It applies only when exactly one reading is still running.
- **Copy, verbatim:**
  - `1 of 3 back` (the count while waiting)
  - `Choose a reading` (chooser label)
  - `(leave out)` (an empty alternative)
  - `2 of 3` (alternative counts)
  - The notes come from `readingsNote` in Task 3.
- **Look:**
  - Only ink `#141413`, paper `#faf9f5` and white, plus ink at 60%, 12%, 7% and 6%.
  - DESIGN.md radii of 8, 16 and 24px, durations of 100, 200 and 800ms, and the `ease-brand` easing.
  - Every interactive element has at least a 44px target, with the existing 2px ink focus outline.
  - Under `prefers-reduced-motion`, nothing blinks or staggers. The existing global rule already covers this.
- **Privacy:** never log, store or send input or output text. Logs carry only lengths, codes, timings, model, temperature and reading.
- **Next.js:** this version differs from what you know (`AGENTS.md`). Read the relevant guide in `node_modules/next/dist/docs/` before touching Next-specific code.
- **UI skill:** load the `design-taste-frontend` skill before writing UI (Task 4).
- **Imports:** use the `@/` alias.
- **Git:**
  - Stage explicit paths only, never `git add -A` or `git add .`.
  - Never stage `test.md`.
  - End every commit message with these two lines:
    ```
    Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01UDMgcvprkktHksKU2yKHQY
    ```
- **Secrets:** never read or print `.env.local`.
- **Real Gemini calls:** only in Task 5 and Task 6. Every call spends free-tier quota.

## Review Focus

1. **A late reply from an older run.** Someone taps one example, then another, before the first returns. No reply from the first run may land in the second run's result. Pinned in Task 4, step 5.
2. **A disagreement at the very start or end of a line.** It must become one span there, with no empty spans on either side. Pinned in Task 2, test `marks a disagreement at the start of a line`.
3. **The same word repeated in a line** (*Amen Amen Amen*, *nem … nem*). The alignment must match words left to right, not invent a span at both ends. Pinned in Task 2, test `aligns repeated words left to right`.
4. **Readings 2 and 3 rate-limited while reading 1 succeeds.** The page must show reading 1 alone, not an error. Pinned in Task 3, test `shows reading 1 alone when readings 2 and 3 were rate-limited`.
5. **Copying after choosing "(leave out)", or when an empty alternative is the default.** No double spaces. Pinned in Task 2, test `drops an empty choice without leaving a double space`.

---

### Task 1: Reading settings and the `reading` field

**Files:**
- Create: `lib/readings.ts`
- Modify: `lib/gemini.ts`, `app/api/transliterate/route.ts`, `scripts/eval.ts` (its `SETUPS` need the new field)
- Test: `lib/gemini.test.ts`, `app/api/transliterate/route.test.ts`
- Docs: `docs/superpowers/specs/2026-10-17-coptic-transliterator-design.md`, sections 4 and 6

**Interfaces:**
- Produces, in `lib/readings.ts` (no server-only imports, so the client can use it):
  ```ts
  export const READING_NUMBERS = [1, 2, 3] as const;
  export type Reading = (typeof READING_NUMBERS)[number];
  ```
- Produces, in `lib/gemini.ts`:
  ```ts
  export type GeminiConfig = { model: string; thinkingLevel: ThinkingLevel; temperature: number };
  export const SAMPLED_TEMPERATURE = 1;
  export const READINGS: Record<Reading, GeminiConfig>;
  export const DEFAULT_CONFIG: GeminiConfig; // the same object as READINGS[1]
  export function transliterate(text: string, config?: GeminiConfig, reading?: Reading): Promise<TransliterationResult>;
  ```

- [ ] **Step 1: Write the failing tests in `lib/gemini.test.ts`.**
  - Add `temperature: 0` to the object passed in `uses a custom model and thinking level when given, and logs that model`.
  - Change `defaults to the production model and low thinking` to expect `{ model: MODEL, thinkingLevel: "LOW", temperature: 0 }`.
  - Add:

```ts
it("defines reading 1 as today's settings and readings 2 and 3 as sampled", () => {
  expect(READINGS[1]).toEqual({ model: "gemini-3.5-flash-lite", thinkingLevel: "LOW", temperature: 0 });
  expect(SAMPLED_TEMPERATURE).toBe(1);
  for (const reading of [2, 3] as const) {
    expect(READINGS[reading]).toEqual({ ...READINGS[1], temperature: SAMPLED_TEMPERATURE });
  }
  expect(DEFAULT_CONFIG).toBe(READINGS[1]);
});

it("sends the config's temperature to Gemini", async () => {
  generateContent.mockResolvedValue({ text: '{"latin":"Amin"}' });
  await transliterate("Ⲁⲙⲏⲛ", READINGS[2], 2);
  expect(generateContent.mock.calls[0][0].config.temperature).toBe(SAMPLED_TEMPERATURE);
});

it("logs the reading and temperature", async () => {
  generateContent.mockResolvedValue({ text: '{"latin":"Amin"}' });
  await transliterate("Ⲁⲙⲏⲛ", READINGS[3], 3);
  await transliterate("Ⲁⲙⲏⲛ");
  const [withReading, withoutReading] = vi.mocked(console.info).mock.calls.map((args) => String(args[0]));
  expect(withReading).toContain('"reading":3');
  expect(withReading).toContain(`"temperature":${SAMPLED_TEMPERATURE}`);
  expect(withoutReading).toContain('"reading":null');
});
```

- [ ] **Step 2: Write the failing tests in `app/api/transliterate/route.test.ts`.**
  - Change the mock to `vi.mock("@/lib/gemini", () => ({ transliterate, READINGS: { 1: "config-1", 2: "config-2", 3: "config-3" } }))`.
  - In `returns the transliteration of the trimmed input`, expect `transliterate` to have been called with `("Ⲁⲙⲏⲛ", "config-1", 1)`.
  - Add:

```ts
it("uses the requested reading's settings", async () => {
  transliterate.mockResolvedValue({ ok: true, latin: "Amin" });
  await call(JSON.stringify({ text: "Ⲁⲙⲏⲛ", reading: 3 }));
  expect(transliterate).toHaveBeenCalledWith("Ⲁⲙⲏⲛ", "config-3", 3);
});

it("rejects a reading other than 1, 2 or 3", async () => {
  for (const reading of [0, 4, "2", 1.5, null]) {
    const { status, json } = await call(JSON.stringify({ text: "Ⲁⲙⲏⲛ", reading }));
    expect(status, String(reading)).toBe(400);
    expect(json, String(reading)).toEqual({
      error: { code: "invalid_input", message: "reading must be 1, 2 or 3." },
    });
  }
  expect(transliterate).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run `npx vitest run lib/gemini.test.ts app/api/transliterate/route.test.ts`.**
  Expected: the new tests fail (`READINGS` or `SAMPLED_TEMPERATURE` undefined, the call arguments don't match, and invalid readings return 200).

- [ ] **Step 4: Implement.**
  - Create `lib/readings.ts` as in Interfaces.
  - In `lib/gemini.ts`, add `temperature` to `GeminiConfig`, and define `READINGS` and `DEFAULT_CONFIG = READINGS[1]`.
  - `callGemini` sends `temperature: config.temperature` in place of the literal `0`.
  - The `transliterate` log line gains `temperature: config.temperature` and `reading: reading ?? null`.
  - Keep the existing comment about why it's flash-lite at low thinking. Add one line saying readings 2 and 3 are sampled so the reader has something to choose between.
  - In `scripts/eval.ts`, add `temperature: 0` to each of the three `SETUPS` configs, so the existing eval mode means what it meant.
  - In the route, check `reading` right after the `text` type check. `undefined` becomes 1. Anything that isn't one of `READING_NUMBERS` (strict equality, so `"2"` and `1.5` fail) returns the 400. Then call `transliterate(input.text, READINGS[reading], reading)`.

- [ ] **Step 5: Run `npm test` and `npm run build`.** Expected: both pass.

- [ ] **Step 6: Update the first spec.**
  - Section 4: change the request body to `{ "text": string, "reading"?: 1 | 2 | 3 }`, and add the invalid-`reading` case to the `invalid_input` row.
  - Section 6's model-call list: add "temperature 0 for reading 1; readings 2 and 3 at `SAMPLED_TEMPERATURE` (see `2026-10-18-three-readings-design.md`)".

- [ ] **Step 7: Commit** `lib/readings.ts`, `lib/gemini.ts`, `lib/gemini.test.ts`, `app/api/transliterate/route.ts`, `app/api/transliterate/route.test.ts`, `scripts/eval.ts` and the spec, with the message `Add three reading settings and an optional reading field to the API`.

---

### Task 2: Merging the readings

**Files:**
- Create: `lib/merge-readings.ts`
- Test: `lib/merge-readings.test.ts`

**Interfaces:**
- Consumes: `Reading` from `lib/readings.ts` (Task 1).
- Produces:
  ```ts
  export type Alternative = { text: string; readings: Reading[] };       // readings ascending
  export type Span = { kind: "span"; id: string; alternatives: Alternative[] }; // alternatives[0] is the default
  export type Token = { kind: "word"; text: string } | Span;
  export type Merged = { lines: Token[][]; readings: Reading[] };       // readings: those merged, ascending
  export type Choices = Readonly<Record<string, number>>;               // span id → alternative index; missing = 0
  export function mergeReadings(texts: Partial<Record<Reading, string>>, inputLineCount: number): Merged;
  export function lineText(line: readonly Token[], choices: Choices): string;
  export function mergedText(merged: Merged, choices: Choices): string;
  ```

- [ ] **Step 1: Write the failing tests** in `lib/merge-readings.test.ts`, with `const w = (text: string) => ({ kind: "word", text })`:

| Test | Input (`texts`, `inputLineCount`) | Expected |
|---|---|---|
| `keeps agreed words and blank lines` | all three `"Khen efran\n\nnem epsheeri"`, 3 | `lines: [[w("Khen"), w("efran")], [], [w("nem"), w("epsheeri")]]`, `readings: [1, 2, 3]` |
| `marks a one-word disagreement, majority first` | 1 `"alla nahmen evolha pipethou:"`, 2 and 3 `"alla nahmen evolha pipethoou:"`, 1 | `[w("alla"), w("nahmen"), w("evolha"), { kind: "span", id: "0:0", alternatives: [{ text: "pipethoou:", readings: [2, 3] }, { text: "pipethou:", readings: [1] }] }]` |
| `groups a split word into one span` | 1 `"evol enneet e ouon"`, 2 and 3 `"evol enneeete ouon"`, 1 | `[w("evol"), span "0:0" [{ "enneeete", [2, 3] }, { "enneet e", [1] }], w("ouon")]` |
| `records a left-out word as an empty alternative` | 1 and 3 `"rasti meef nan emfoou:"`, 2 `"rasti meef emfoou:"`, 1 | `[w("rasti"), w("meef"), span "0:0" [{ "nan", [1, 3] }, { "", [2] }], w("emfoou:")]` |
| `ignores case and punctuation, showing reading 1's form` | 1 `"nem Pipnevma Ethouab:"`, 2 `"nem Pipnevma ethouab"`, 3 `"nem pipnevma Ethouab:"`, 1 | `[w("nem"), w("Pipnevma"), w("Ethouab:")]` |
| `combines alternatives that differ only in case or punctuation` | 1 `"pipethou:"`, 2 `"Pipethoou"`, 3 `"pipethoou:"`, 1 | `[span "0:0" [{ "Pipethoou", [2, 3] }, { "pipethou:", [1] }]]` |
| `splits neighbouring disagreements of equal length into one span per word` | 1 `"alla nahmen evolha pipethou:"`, 2 `"alla nahmen evolha pipethoou:"`, 3 `"alla nahmen ebolha pipethoou:"`, 1 | `[w("alla"), w("nahmen"), span "0:0" [{ "evolha", [1, 2] }, { "ebolha", [3] }], span "0:1" [{ "pipethoou:", [2, 3] }, { "pipethou:", [1] }]]` |
| `orders a three-way tie by reading number` | 1 `"ebol"`, 2 `"evol"`, 3 `"efol"`, 1 | span alternatives `[{ "ebol", [1] }, { "evol", [2] }, { "efol", [3] }]` |
| `numbers spans per line` | 1 `"a x b y\nc z"`, 2 and 3 `"a X1 b Y1\nc Z1"`, 2 | span ids `"0:0"`, `"0:1"`, `"1:0"` |
| `uses the lowest reading present as the base` | 2 `"a x"`, 3 `"a y"`, 1 | `[w("a"), span [{ "x", [2] }, { "y", [3] }]]`, `readings: [2, 3]` |
| `returns a single reading as plain words` | 1 `"Amen"`, 1 | `lines: [[w("Amen")]]`, `readings: [1]` |
| `leaves out a reading with the wrong line count` | 1 `"a\nb"`, 2 `"a b"`, 3 `"a\nc"`, 2 | `lines: [[w("a")], [span [{ "b", [1] }, { "c", [3] }]]]`, `readings: [1, 3]` |
| `falls back to the lowest reading, unmarked, when none has the right line count` | 1 `"a b c"`, 2 `"a\nb\nc"`, 2 | `lines: [[w("a"), w("b"), w("c")]]`, `readings: [1]` |
| `marks a disagreement at the start of a line` (Review Focus 2) | 1 and 3 `"Khen efran"`, 2 `"Ghen efran"`, 1 | `[span "0:0" [{ "Khen", [1, 3] }, { "Ghen", [2] }], w("efran")]` |
| `aligns repeated words left to right` (Review Focus 3) | 1 and 3 `"Amen Amen Amen"`, 2 `"Amen Amen Amin"`, 1 | `[w("Amen"), w("Amen"), span "0:0" [{ "Amen", [1, 3] }, { "Amin", [2] }]]` |

  Also add two `lineText`/`mergedText` tests:
  - `drops an empty choice without leaving a double space` (Review Focus 5). Merge 1 `"a nan b"`, 2 and 3 `"a b"` (1 line). Then:
    - `lineText(line, {})` is `"a b"`, because the default is the empty alternative from readings 2 and 3
    - `lineText(line, { "0:0": 1 })` is `"a nan b"`
  - `joins lines with line breaks, using each choice`. For `mergedText` on the "numbers spans per line" input, with `{ "0:1": 1 }`, expect `"a X1 b y\nc Z1"`.

- [ ] **Step 2: Run `npx vitest run lib/merge-readings.test.ts`.** Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement `lib/merge-readings.ts`.** The tests don't pin down this algorithm, so follow it:
  1. **Pick the readings to merge.** Split each text on `/\r?\n/`, and keep those whose line count equals `inputLineCount`. If none remain, return the lowest-numbered reading's lines as plain words, with `readings` set to that one reading.
  2. **Per line,** tokenize each kept reading with `line.trim().split(/\s+/)`, dropping the empty token of a blank line. The comparison key is `token.toLowerCase().replace(/\p{P}/gu, "")`. The **base** is the lowest-numbered kept reading.
  3. **Align each other reading against the base by key.** Compute LCS lengths over suffixes. Walk forward from the start: take a match when both keys are equal and matching keeps the LCS length; otherwise advance the side whose remaining LCS is longer, the other reading on a tie. This left-to-right preference is what makes the repeated-words test pass.
  4. **Anchors.** A base token is an **anchor** when every other reading matched it. Between consecutive anchors (and before the first and after the last), each reading has a region: its tokens strictly between its matches of those anchors.
  5. **Spans.** If the regions' keys agree, ignoring tokens whose key is empty (punctuation only), emit the base region's tokens as words. If every reading's region has the same number of tokens, handle each token position as its own one-token region: a word where the keys agree, a span where they don't. Otherwise emit one span for the whole region:
     - each reading's region becomes an alternative, its tokens joined with one space (possibly `""`)
     - combine alternatives with equal keys, keeping the lowest-numbered reading's text and collecting the reading numbers
     - sort by number of readings descending, then by lowest reading number
     - the id is `${lineIndex}:${spanIndexInLine}`
     - emit each anchor as a word in the base's form
  6. `lineText` joins the chosen texts (`alternatives[choices[id] ?? 0].text` for spans), skipping empty ones, with single spaces. `mergedText` joins `lineText` results with `"\n"`.

- [ ] **Step 4: Run `npx vitest run lib/merge-readings.test.ts`, then `npm test`.** Expected: everything passes.

- [ ] **Step 5: Commit** `lib/merge-readings.ts` and `lib/merge-readings.test.ts`, with the message `Merge three readings into words and choosable spans`.

---

### Task 3: Sending readings and settling the results

**Files:**
- Modify: `app/request-transliteration.ts`, `app/view-helpers.ts`, `app/transliterator.tsx` (one call site only)
- Create: `app/settle-readings.ts`
- Test: `app/request-transliteration.test.ts`, `app/settle-readings.test.ts`, `app/view-helpers.test.ts`

**Interfaces:**
- Consumes: `Reading` and `READING_NUMBERS` (Task 1), and `mergeReadings` and `Merged` (Task 2).
- Produces:
  ```ts
  // app/request-transliteration.ts (the reading is now the second parameter)
  export function requestTransliteration(text: string, reading: Reading, fetchImpl?: typeof fetch, signal?: AbortSignal): Promise<ClientResult>;
  // app/settle-readings.ts
  export const STRAGGLER_MS = 10000;
  export type ReadingStatus = "waiting" | "back" | "failed";
  export type Statuses = Record<Reading, ReadingStatus>;
  export type Results = Partial<Record<Reading, ClientResult>>;
  export type Settled =
    | { kind: "waiting"; statuses: Statuses }
    | { kind: "done"; statuses: Statuses; merged: Merged }
    | { kind: "error"; message: string; retryable: boolean };
  export function settleReadings(results: Results, inputLineCount: number, stopWaiting: boolean): Settled;
  export function stragglerDelay(results: Results, firstBackAt: number | null, now: number): number | null;
  // app/view-helpers.ts
  export function readingsBackLabel(statuses: Statuses): string;
  export function readingsNote(mergedCount: number, spans: number, chosen: number): string;
  ```

- [ ] **Step 1: Update `app/request-transliteration.test.ts` and write the new tests.**
  - Insert `1` as the second argument in every existing call.
  - The first test's expected body becomes `JSON.stringify({ text: "Ⲁⲙⲏⲛ", reading: 1 })`.
  - Add `sends the reading number`: calling with reading `2` posts `JSON.stringify({ text: "Ⲁⲙⲏⲛ", reading: 2 })`.

- [ ] **Step 2: Write `app/settle-readings.test.ts`.**
  Use these helpers:
  - `ok = (latin: string) => ({ ok: true, latin })`
  - `fail = (message = GENERIC_ERROR_MESSAGE, retryable = true) => ({ ok: false, aborted: false, message, retryable })`

  | Test | Call | Expected |
  |---|---|---|
  | `waits while any reading is running` | `settleReadings({ 1: ok("a") }, 1, false)` | `{ kind: "waiting", statuses: { 1: "back", 2: "waiting", 3: "waiting" } }` |
  | `shows a failure while still waiting` | `({ 1: fail(), 2: ok("a") }, 1, false)` | waiting, `{ 1: "failed", 2: "back", 3: "waiting" }` |
  | `merges when all three are back` | `({ 1: ok("a"), 2: ok("a"), 3: ok("b") }, 1, false)` | `{ kind: "done", statuses: { 1: "back", 2: "back", 3: "back" }, merged: mergeReadings({ 1: "a", 2: "a", 3: "b" }, 1) }` |
  | `merges what came back when one failed` | `({ 1: ok("a"), 2: fail(RATE_LIMITED_MESSAGE), 3: ok("b") }, 1, false)` | done, statuses `{ 1: "back", 2: "failed", 3: "back" }`, `merged.readings` `[1, 3]` |
  | `counts a straggler as failed once it stops waiting` | `({ 1: ok("a"), 2: ok("a") }, 1, true)` | done, `statuses[3]` `"failed"` |
  | `marks a reading left out of the merge as failed` | `({ 1: ok("a\nb"), 2: ok("a b"), 3: ok("a\nb") }, 2, false)` | done, `statuses[2]` `"failed"`, `merged.readings` `[1, 3]` |
  | `shows reading 1 alone when readings 2 and 3 were rate-limited` (Review Focus 4) | `({ 1: ok("Amen"), 2: fail(RATE_LIMITED_MESSAGE), 3: fail(RATE_LIMITED_MESSAGE) }, 1, false)` | done, `merged.readings` `[1]`, statuses `{ 1: "back", 2: "failed", 3: "failed" }` |
  | `uses the rate-limit message when all failed and one was rate-limited` | `({ 1: fail(), 2: fail(RATE_LIMITED_MESSAGE), 3: fail() }, 1, false)` | `{ kind: "error", message: RATE_LIMITED_MESSAGE, retryable: true }` |
  | `otherwise uses the lowest reading's failure` | all three `fail("Enter some Coptic text to transliterate.", false)` | `{ kind: "error", message: "Enter some Coptic text to transliterate.", retryable: false }` |
  | `treats aborted results as failed` | all three `{ ok: false, aborted: true }` | `{ kind: "error", message: GENERIC_ERROR_MESSAGE, retryable: true }` |

  And for `stragglerDelay`:

  | Test | Call | Expected |
  |---|---|---|
  | `waits without a deadline while two are running` | `stragglerDelay({ 1: ok("a") }, 1000, 1500)` | `null` |
  | `counts down once only one is running` | `({ 1: ok("a"), 2: fail() }, 1000, 4000)` | `7000` |
  | `is due at once when overdue` | `({ 1: ok("a"), 2: ok("a") }, 1000, 12000)` | `0` |
  | `has no deadline before anything is back or after all are` | `({}, null, 0)` and `({ 1: ok("a"), 2: ok("a"), 3: ok("a") }, 1000, 2000)` | `null` both |

- [ ] **Step 3: Add to `app/view-helpers.test.ts`.**

```ts
describe("readingsBackLabel", () => {
  it("counts the readings that came back", () => {
    expect(readingsBackLabel({ 1: "back", 2: "waiting", 3: "failed" })).toBe("1 of 3 back");
  });
});

describe("readingsNote", () => {
  it("says what the reader can do with the readings", () => {
    expect(readingsNote(3, 0, 0)).toBe("All 3 readings agree");
    expect(readingsNote(3, 2, 0)).toBe("2 words where the readings disagree · tap one to choose");
    expect(readingsNote(3, 1, 0)).toBe("1 word where the readings disagree · tap it to choose");
    expect(readingsNote(3, 2, 1)).toBe("1 of 2 chosen");
    expect(readingsNote(2, 1, 0)).toBe("2 of 3 readings came back · 1 word where the readings disagree · tap it to choose");
    expect(readingsNote(2, 0, 0)).toBe("2 of 3 readings came back · they agree");
    expect(readingsNote(1, 0, 0)).toBe("1 of 3 readings came back");
  });
});
```

- [ ] **Step 4: Run `npx vitest run app/`.** Expected: the new tests fail, with the module not found, functions not exported, or the body missing `reading`.

- [ ] **Step 5: Implement.**
  - `requestTransliteration` posts `{ text, reading }`. Nothing else in it changes. Pass `1` as the reading in the one existing call in `app/transliterator.tsx`, so the build stays green until Task 4 replaces that code.
  - `settleReadings`:
    - A result is "back" when `ok`. Anything else (failure or aborted) is "failed". A missing result is "waiting", or "failed" when `stopWaiting` is set.
    - It returns `waiting` while any reading is waiting.
    - When nothing is ok, it returns the error described by the tests.
    - Otherwise it merges the ok results with `mergeReadings`, and any reading that came back but isn't in `merged.readings` becomes "failed".
  - `stragglerDelay`: returns `max(0, firstBackAt + STRAGGLER_MS − now)` when exactly two results are present, otherwise `null`.
  - `readingsNote`:
    - `mergedCount === 1` returns `"1 of 3 readings came back"` alone.
    - `mergedCount === 2` prefixes `"2 of 3 readings came back · "` and uses `"they agree"` when there are no spans.
    - `mergedCount === 3` with no spans returns `"All 3 readings agree"`.

- [ ] **Step 6: Run `npm test` and `npm run build`.** Expected: both pass.

- [ ] **Step 7: Commit** the seven files, with the message `Send a reading number and settle three results into one outcome`.

---

### Task 4: The page

**Files:**
- Create: `app/reading-dots.tsx`, `app/merged-text.tsx`
- Modify: `app/output-panel.tsx`, `app/transliterator.tsx`
- Docs: `docs/superpowers/specs/2026-10-18-page-redesign-design.md` (Output section)

**Interfaces:**
- Consumes:
  - `Statuses`, `ReadingStatus`, `settleReadings`, `stragglerDelay` and `STRAGGLER_MS` (Task 3)
  - `requestTransliteration(text, reading, fetch, signal)` (Task 3)
  - `readingsBackLabel` and `readingsNote` (Task 3)
  - `Merged`, `Span`, `Choices`, `lineText` and `mergedText` (Task 2)
  - `READING_NUMBERS` (Task 1)
- Produces:
  ```ts
  export function ReadingDots(props: { statuses: Statuses; withLabel: boolean }): JSX.Element;
  export function MergedText(props: { merged: Merged; choices: Choices; onPick: (line: number, span: Span, chosenIndex: number) => void }): JSX.Element;
  // OutputPanel's phase prop becomes:
  //   { kind: "loading"; rows: number[]; statuses: Statuses } | { kind: "done"; merged: Merged; statuses: Statuses }
  ```

There's no DOM test setup. This task is verified in the browser, against the mockup.

- [ ] **Step 1: Load the `design-taste-frontend` skill**, open the mockup, and read spec section 7 in full.

- [ ] **Step 2: `ReadingDots`.**
  - Three 8px dots with a 1.5px ink border, in reading order:
    - `waiting`: blinks with the existing `animate-dot-blink`
    - `back`: solid ink
    - `failed`: dashed border at 45% opacity
  - With `withLabel`, add `readingsBackLabel(statuses)` in 12px mono ink-60.
  - The dots are `aria-hidden`. The label, or a visually hidden copy of it when `withLabel` is off, carries the count for screen readers.

- [ ] **Step 3: `MergedText`.**
  - Render each line as a block inside a `div`, not a `p`, because the chooser can't sit inside a paragraph. Keep today's line rise and the `lineDelayMs` stagger.
  - Spans are `<button>`s showing `alternatives[choices[id] ?? 0].text`:
    - default: ink at 7%, 4px radius, inset 2px ink underline
    - open: solid ink, paper text
    - chosen (`id in choices`): underline only
    - empty: a small marked gap, drawn your way
  - Keep the line height. Reach the 44px target with an absolutely positioned pseudo-element.
  - Each span has `aria-expanded` and `aria-controls`, and an accessible name that includes the word and "choose a reading".
  - `MergedText` owns which span is open. Only one is open at a time.
  - **The chooser** is a block right after the open span's line. It has white background, 16px radius, `shadow-card` and a 1px ink-12 ring.
    - It starts with the label `Choose a reading` in 12px mono ink-60.
    - Then comes a `role="listbox"` of 44px `role="option"` rows, in alternatives order. Each shows the text (empty text is `(leave out)`) and a 12px mono count, `${readings.length} of 3`. The current choice has `aria-selected` and is solid ink with paper text.
    - Opening focuses the current row. ArrowUp and ArrowDown move focus, Enter or Space picks.
    - Picking calls `onPick(line, span, index)`, closes the chooser, and returns focus to the span.
    - Escape, tapping the span again, or a pointerdown outside the chooser and span closes it without picking.

- [ ] **Step 4: `OutputPanel`.**
  - The header keeps the ink rule and the `Latin` label. On the right:
    - while loading: `<ReadingDots withLabel />`
    - when done and every status is `back`: Copy alone
    - when done and any status is `failed`: `<ReadingDots withLabel={false} />` beside Copy
  - Loading keeps today's skeleton and the 8-second hint.
  - Done renders `MergedText`, then the note `readingsNote(merged.readings.length, spanCount, chosenCount)` in 15px ink-60.
  - Choices live in `OutputPanel` state. The panel is already keyed by run id, so they reset each run.
  - **Every pick goes through one function,** `recordChoice(line: number, span: Span, chosenIndex: number)`. Today it only sets state. Give it a comment that it's where saving choices for the nightly analysis would go later (spec section 8).
  - Copy uses `mergedText(merged, choices)`. The fallback that selects the text by hand selects the text container.

- [ ] **Step 5: `Transliterator.run`.**
  - Keep the current run in a ref: `{ controller, results: Results, firstBackAt: number | null, timer, settled: boolean }`.
  - Starting a run aborts the previous controller and clears its timer.
  - For each of `READING_NUMBERS`, call `requestTransliteration(input.text, reading, fetch, controller.signal)`. On each reply:
    - ignore it unless the run is still `runRef.current` and not `settled`, and the reply isn't `aborted`
    - otherwise record it, set `firstBackAt` on the first, and call `update(run, false)`
  - `update(run, stopWaiting)`:
    - calls `settleReadings(run.results, lineCount, stopWaiting)`, where `lineCount = input.text.split(/\r?\n/).length`
    - `waiting`: sets the loading phase with the statuses. If `stragglerDelay(...)` isn't null and no timer is set, it sets one that calls `update(run, true)`
    - `done` or `error`: marks the run settled, clears the timer, and sets that phase. An error uses today's error UI, and Try again re-runs the last text
  - Clear aborts and clears the timer, as cancelling does today.
  - **Review Focus 1, in the browser:** press "The Lord's Prayer", then within a second press "In the name of the Father". The final output must be the second example's, with three settled dots, and no text from the first may appear at any point.

- [ ] **Step 6: Browser checks at 390px and 1280px**, with `npm run dev` on `localhost:3000`. Each check uses three real requests.
  - the dots while waiting
  - a result with marks: try "The Lord's Prayer"
  - choosing, then changing the choice
  - Copy after choosing
  - all agree: try "In the name of the Father"
  - one request failing, forced your way
  - all failing, then Try again
  - Clear during loading
  - keyboard-only use of the chooser
  - reduced motion
  - Review Focus 1, from step 5

- [ ] **Step 7: Update the redesign spec's Output section.** Add a line saying the output's header, text and choosing now follow `2026-10-18-three-readings-design.md`, section 7.

- [ ] **Step 8: Run `npm test` and `npm run build`.** Expected: both pass.

- [ ] **Step 9: Commit** the four app files and the spec, with the message `Show three readings as one text with choosable disagreements`.

---

### Task 5: Evaluation mode and the temperature

**Files:**
- Create: `lib/eval-readings.ts`
- Modify: `scripts/eval.ts`, and `lib/gemini.ts` if the temperature changes
- Test: `lib/eval-readings.test.ts`, and `lib/gemini.test.ts` if the temperature changes
- Docs: the first spec's iteration table (section 13); `docs/superpowers/specs/2026-10-18-three-readings-design.md` section 4, if the temperature changes

**Interfaces:**
- Consumes:
  - `mergeReadings`, `lineText`, `mergedText` and `Merged` (Task 2)
  - `scorePair` and `summarize` (`lib/eval-score.ts`)
  - `READINGS`, `SAMPLED_TEMPERATURE` and `transliterate` (Task 1)
- Produces:
  ```ts
  export type ReadingsScore = { spans: number; useful: number; noise: number; reachable: boolean };
  export function scoreReadings(merged: Merged, gold: string): ReadingsScore;
  ```

- [ ] **Step 1: Write `lib/eval-readings.test.ts`.**
  Let `merged = mergeReadings({ 1: "alla nahmen evolha pipethou:", 2: "alla nahmen evolha pipethoou:", 3: "alla nahmen ebolha pipethoou:" }, 1)`.
  - `counts a span where reading 1 was wrong as useful and one where it was right as noise`: `scoreReadings(merged, "alla nahmen evolha pipethoou:")` equals `{ spans: 2, useful: 1, noise: 1, reachable: true }`.
  - `is unreachable when no choice gives the gold spelling`: `scoreReadings(merged, "alla nahmen evolha pipethooou:").reachable` is `false`.
  - `scores an unmarked result by exact match`: for `mergeReadings({ 1: "Amen" }, 1)`, gold `"Amen"` gives `{ spans: 0, useful: 0, noise: 0, reachable: true }`, and gold `"Amin"` gives `reachable: false`.

- [ ] **Step 2: Run `npx vitest run lib/eval-readings.test.ts`.** Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement `scoreReadings`.**
  - If the merged and gold line counts differ, every span is noise, and `reachable` is `scorePair(mergedText(merged, {}), gold).exact`.
  - Otherwise, per line and per span, try each alternative with the other spans at their default. Score `lineText` against the gold line with `scorePair`.
    - The best alternative has the highest `charAccuracy`. On a tie, prefer reading 1's alternative (the one whose `readings` includes 1, or index 0 when reading 1 isn't merged), then the lower index.
    - A span is **useful** when its best alternative isn't reading 1's, otherwise **noise**.
    - `reachable` means every line, with every span at its best alternative, is an exact match.

- [ ] **Step 4: Run `npm test`.** Expected: everything passes.

- [ ] **Step 5: Add the `three` mode to `scripts/eval.ts`.**
  - It runs as `npm run eval -- three [temperature]`, where the temperature defaults to `SAMPLED_TEMPERATURE`.
  - For each held-out pair, call `transliterate` with `READINGS[1]`, then `{ ...READINGS[2], temperature }`, then `{ ...READINGS[3], temperature }`, one after another, with `DELAY_MS` between calls. Merge the results with the Coptic's line count.
  - Print per pair: the gold, reading 1, the default merged text, and each span's alternatives with counts.
  - End with one `console.table` row:

    | Column | Value |
    |---|---|
    | `temperature` | the run's temperature |
    | `reading 1 exact` | as today's mode |
    | `reading 1 chars` | as today's mode |
    | `merged exact` | over `mergedText(merged, {})` |
    | `merged chars` | over `mergedText(merged, {})` |
    | `spans/line` | total spans ÷ total lines |
    | `useful` | total |
    | `noise` | total |
    | `reachable` | percentage of pairs |

  - A failed reading is left out of the merge, as in the app. Print its error code.
  - The existing setup-filter mode is unchanged.

- [ ] **Step 6: Commit** `lib/eval-readings.ts`, its test and `scripts/eval.ts`, with the message `Add a three-readings eval mode with useful and noise span counts`.

- [ ] **Step 7: Tune with the spec's stop rule (section 9).** Each run takes about 11 minutes and 48 requests.
  1. Run `npm run eval -- three 1`.
  2. If it fails the rule, run `three 0.7`, then `three 0.4`. Stop at the first that passes.
  3. A run with more than three errors doesn't count. If two runs in a row are like that, stop: the quota is probably used up for today.
  4. **If none passes, stop here and report all the tables to the user.** Don't change `SAMPLED_TEMPERATURE`, and don't continue to Task 6.

- [ ] **Step 8: Record the result.**
  - If the passing temperature isn't 1, change `SAMPLED_TEMPERATURE` and its test expectation, and update spec section 4's "temperature 1.0".
  - Add each run's table to the first spec's iteration table, as part of the iteration 2 row, with the chosen temperature.
  - Run `npm test`, then commit the touched files with the message `Set the sampled temperature from the three-readings eval`.

---

### Task 6: End-to-end check and close-out

**Files:**
- Docs: `docs/superpowers/specs/2026-10-18-three-readings-design.md` (status line)

- [ ] **Step 1: Run `npm test` and `npm run build`.** Expected: both pass.

- [ ] **Step 2: One real run through the full stack.** With `npm run dev`, press "The Lord's Prayer" at 390px. Confirm all of these:
  - three dots fill in
  - the text shows marks on some disagreements
  - a choice changes the copied text
  - the server log shows three `transliterate` lines with `reading` 1, 2 and 3, and no text

  Note how long the run took from submit to text, and compare it with a single request today.

- [ ] **Step 3: Set the spec's status** to `Implemented (approved by the user on 2026-10-18)`, then commit it with the message `Mark the three-readings design implemented`.

- [ ] **Step 4: Don't merge or push.** Report to the user that the branch is ready, with the eval table and the timing from step 2. Merging to `main` deploys to the live site, so it waits for the user's go-ahead.
