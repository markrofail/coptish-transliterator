# Long Hymns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A paste of up to 16,000 characters works. Over 4,000, it's split into parts at safe boundaries and taken bite by bite. Finished parts fold away, and Copy all copies the whole hymn.

**Architecture:**
- **Pure core:** a pure splitter, `lib/split-parts.ts`, cuts the paste into parts of at most 4,000 code points. The server and API are untouched, because each part is an ordinary request.
- **One run helper:** the three-readings run logic moves out of `Transliterator` into a node-testable helper, `app/run-readings.ts`. Short pastes and each part use it the same way.
- **Shared choices:** reader choices move up into `Transliterator`, so one `recordChoice` serves both paths, and choices survive folding.
- **Two panels:** a short paste renders through today's `OutputPanel`. A long paste renders through a new `HymnPanel`. Both share an extracted `PartBody`: skeleton, merged text and note.

**Tech Stack:** Next.js 16.4.2 (App Router), React 19.3.1, TypeScript 5, Tailwind CSS 4, Vitest 4 (node environment, no DOM), and Playwright driving the installed Google Chrome for browser checks. Node 20.19.2.

**Spec:** `docs/superpowers/specs/2026-10-18-long-hymns-design.md`, plus its approved mockup, `docs/superpowers/specs/2026-10-18-long-hymns-states.html`. It builds on `2026-10-18-three-readings-design.md`. Section numbers below refer to the long-hymns spec.

## Global Constraints

- **Branch:** work on `long-hymns`. It already exists, with the spec committed.
- **Limits:**
  - per request: `MAX_INPUT_LENGTH = 4000`, unchanged, still enforced by the server
  - per paste, on the page: `MAX_PASTE_LENGTH = 16000`
  - both count code points after trimming
  - a part is at most `MAX_INPUT_LENGTH` code points
- **Short pastes** of 4,000 or fewer look and behave exactly as today.
- **Copy, verbatim:**
  - Counter: `9,000 / 16,000 · 3 parts` (both numbers with `toLocaleString("en-US")`)
  - Composer button: `Transliterate part 1`, otherwise `Transliterate`, and `Transliterating` while loading
  - Part labels: `Part 2 of 3`, `Next part`, `Finish`, `Show`, `Hide`
  - All-done controls: `All 3 parts done`, `Show the whole hymn`, `Fold all`
  - Header: `Latin · whole hymn`; Copy all reads `Copy all`, then `Copied`
  - Incomplete part: `Some lines may be missing from this part`, plus `Try again`
  - Over-limit message: `That's 16001 characters. The limit is 16000, so try a shorter passage.` (today's format, no thousands separator)
  - Folded-row text comes from `foldedLabel` (Task 3).
- **Look:**
  - Only ink `#141413`, paper `#faf9f5` and white, plus ink at 60%, 12%, 7% and 6%.
  - DESIGN.md radii (8, 16, 24px) and durations (100, 200, 800ms), with `ease-brand`.
  - Every interactive element has at least a 44px target, with the existing 2px ink focus outline.
  - Under `prefers-reduced-motion`, nothing animates. The existing global rule covers this.
- **Privacy:** never log, store or send input or output text.
- **Next.js:** this version differs from what you know (`AGENTS.md`). Read the relevant guide in `node_modules/next/dist/docs/` before touching Next-specific code.
- **UI skill:** load the `design-taste-frontend` skill before writing UI (Task 4).
- **Imports:** use the `@/` alias.
- **Git:**
  - Stage explicit paths only, never `git add -A` or `git add .`.
  - Never stage `test.md`.
  - End every commit message with:
    ```
    Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01UDMgcvprkktHksKU2yKHQY
    ```
- **Secrets:** never read or print `.env.local`.
- **Real Gemini calls:** only in Task 5. Browser checks before that stub `POST /api/transliterate` with Playwright's `page.route`.
- **Dev server:**
  - One may already be running on `localhost:3000`. It's the user's: don't stop it.
  - If you need your own, `next dev` refuses a second instance in this directory. Use `npm run build`, then `npx next start -p 3100`, and stop it afterwards.
  - Always use `localhost`.

## Review Focus

1. **A late reply from a discarded run.** Pressing Transliterate again, Clear, or an example mid-part must stop every reply of the old run from reaching the page. Pinned in Task 2, test `stop drops every later reply`, and in Task 4's browser checks.
2. **Choices surviving folds.** A choice made in part 1, then Next part, Show, Hide, Show the whole hymn and Fold all, is still in the text and in Copy all. Pinned in Task 4, step 6.
3. **Copy all across cut types.** Parts cut at a blank line, a line break and a plain space must join back as a stanza break, a line break and a space. Pinned in Task 1, test `joins pieces with their parts' separators`.
4. **Pastes at the edges of the limits.** 4,000 is one part, 4,001 is two, 16,000 is accepted and 16,001 is rejected. Pinned in Task 1, tests `keeps a paste of 4,000 as one part` and `accepts 16,000 code points and rejects 16,001`.
5. **Windows line endings.** A `\r\n\r\n` stanza break must count as a blank line for cutting and for the separator. Pinned in Task 1, test `treats \r\n line endings like \n`.

---

### Task 1: The paste limit, the splitter and the join

**Files:**
- Create: `lib/split-parts.ts`, `lib/split-parts.test.ts`
- Modify: `lib/validate.ts`, `lib/validate.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // lib/validate.ts
  export const MAX_PASTE_LENGTH = 16000;
  export function validateInput(raw: string, limit?: number): InputCheck; // limit defaults to MAX_INPUT_LENGTH
  // lib/split-parts.ts
  export type Separator = "" | " " | "\n" | "\n\n";
  export type Part = { text: string; separator: Separator }; // separator: the whitespace removed before this part; "" for the first part and after a hard cut
  export function splitParts(text: string): Part[];           // text: validated and trimmed
  export function joinParts(pieces: readonly { separator: Separator; text: string }[]): string;
  ```

- [ ] **Step 1: Write the failing tests.**
  - In `lib/validate.test.ts`, add `accepts 16,000 code points and rejects 16,001` (Review Focus 4):
    - `validateInput(COPTIC_LETTER.repeat(16000), MAX_PASTE_LENGTH).ok` is `true`
    - for 16,001 the message is exactly `That's 16001 characters. The limit is 16000, so try a shorter passage.`
    - `MAX_PASTE_LENGTH` is `16000`
    - the existing 4,000 tests stay unchanged

  - In `lib/split-parts.test.ts`, use these helpers:
    - `const stanza = (i: number) => \`ⲁⲣⲓⲡ̀ⲣⲉⲥⲃⲉⲩⲓⲛ ⲉ̀ϩ̀ⲣⲏⲓ ⲉ̀ϫⲱⲛ:\nⲱ̀ ⲡⲉⲛϭⲟⲓⲥ ${i}:\nⲙⲁⲣⲓⲁ ⲑ̀ⲙⲁⲩ:\nⲛ̀ⲧⲉϥⲭⲁ ⲛⲉⲛⲛⲟⲃⲓ ⲛⲁⲛ ⲉ̀ⲃⲟⲗ.\``
    - `const hymn = (n: number, gap = "\n\n") => Array.from({ length: n }, (_, i) => stanza(i)).join(gap)`
    - `const len = (s: string) => [...s].length`

  | Test | Input | Expected |
  |---|---|---|
  | `keeps a paste of 4,000 as one part` (Review Focus 4) | `"ⲁ ".repeat(2000).trim()`, then the same plus `"ⲁⲁ"` (just over 4,000) | the first gives `[{ text, separator: "" }]`; the second gives 2 parts |
  | `splits into balanced parts of at most 4,000` | `hymn(106)` (9,004 code points) | 3 parts; every `len(part.text)` is ≤ 4000 and ≥ 2000 |
  | `cuts at stanza breaks when there are any` | `hymn(106)` | every part after the first has `separator: "\n\n"`, and every part ends with `ⲉ̀ⲃⲟⲗ.` |
  | `cuts at a line break when there are no stanza breaks` | `hymn(106, "\n")` | every part after the first has `separator: "\n"` |
  | `cuts after a colon or full stop when there are no line breaks` | `hymn(106).replace(/\s+/g, " ")` | every part after the first has `separator: " "`, and each part before a cut ends with `:` or `.` |
  | `cuts at a space when there is no punctuation` | `"ⲁⲃⲅ ".repeat(3000).trim()` | parts each ≤ 4000, separators `" "`, and no part starts or ends with whitespace |
  | `never cuts inside a word` | each input above | every cut falls between two whitespace-separated words: `parts.flatMap(p => p.text.split(/\s+/))` equals `input.split(/\s+/)` |
  | `hard-cuts a text with no spaces at 4,000` | `"ⲁ".repeat(9000)` | parts of 4000, 4000 and 1000 with separators `""`; their joined texts equal the input |
  | `handles the 16,000 maximum` | `hymn(187)` (15,970 code points) | 4 parts, each ≤ 4000 |
  | `treats \r\n line endings like \n` (Review Focus 5) | `hymn(106).replace(/\n/g, "\r\n")` | separators after the first are `"\n\n"` |
  | `joins pieces with their parts' separators` (Review Focus 3) | `joinParts([{ separator: "", text: "a" }, { separator: "\n\n", text: "b" }, { separator: "\n", text: "c" }, { separator: " ", text: "d" }, { separator: "", text: "e" }])` | `"a\n\nb\nc de"` |
  | `round-trips every input` | each input above | `joinParts(splitParts(x))` equals `x`, with each cut's whitespace run collapsed to its separator. That's exact for the `hymn(...)` inputs, whose cuts are single runs. For the `\r\n` input, compare against the input with `\r\n` → `\n`. |

- [ ] **Step 2: Run `npx vitest run lib/split-parts.test.ts lib/validate.test.ts`.** Expected: FAIL, with `split-parts` not found and `MAX_PASTE_LENGTH` undefined.

- [ ] **Step 3: Implement.**
  - **`validateInput`:** the length check uses `limit`, and its message interpolates `limit`. Nothing else changes, and the server's call stays argument-free.
  - **`splitParts`:** the tests don't determine this algorithm, so follow it. Work on code points (`[...text]`).
    1. If the length is ≤ 4000, return one part.
    2. Otherwise, while more than 4000 code points remain from `start`:
       - Compute `n = ceil(remaining / 4000)` and `target = start + round(remaining / n)`.
       - Collect the **whitespace runs** whose first index `p` falls in `(start, start + 4000]`. Each run is a maximal stretch of `\s`.
    3. Classify each run:
       - **blank** if it contains two or more `\n`
       - **line** if it contains exactly one
       - **punct** if it has no `\n` and the code point before it is `:`, `.` or `·`
       - **space** otherwise
    4. For each class in that order, look first within `[target − 1000, target + 1000]`, then anywhere in the range. The first class with a candidate wins, and among its runs the one whose start is closest to `target` wins.
    5. Cut there:
       - The part is `start..p`.
       - The run's class gives the next part's separator: blank is `"\n\n"`, line is `"\n"`, and punct or space is `" "`.
       - The next `start` is the run's end.
    6. If there's no whitespace run at all, hard-cut at `start + 4000`, with separator `""`.
    7. The rest is the last part.
  - **`joinParts`:** concatenates `separator + text` over the pieces in order.

- [ ] **Step 4: Run `npx vitest run lib/split-parts.test.ts lib/validate.test.ts`, then `npm test` and `npm run build`.** Expected: all pass.

- [ ] **Step 5: Commit** the four files, with the message `Split long pastes into balanced parts at safe boundaries`.

---

### Task 2: One run helper, and choices lifted to `Transliterator`

**Files:**
- Create: `app/run-readings.ts`, `app/run-readings.test.ts`
- Modify: `app/transliterator.tsx`, `app/output-panel.tsx`

**Interfaces:**
- Consumes:
  - `requestTransliteration(text, reading, fetchImpl, signal)`
  - `settleReadings`, `stragglerDelay` and `Settled` (`app/settle-readings.ts`)
  - `READING_NUMBERS`
- Produces:
  ```ts
  // app/run-readings.ts — one set of three readings for one text; returns stop()
  export function runReadings(text: string, onUpdate: (settled: Settled) => void, fetchImpl?: typeof fetch): () => void;
  // OutputPanel gains: choices: Choices; onPick: (line: number, span: Span, chosenIndex: number) => void
  ```

This task changes no behaviour. Short pastes must look and work exactly as before.

- [ ] **Step 1: Write `app/run-readings.test.ts`.**
  - **Setup:** a fake `fetch` built with `vi.fn` that returns a deferred promise per call, so tests resolve replies in any order. Use `vi.useFakeTimers()` for the cut-off.
  - **`sends the text once per reading`:** three calls whose bodies are `{ text, reading: 1 }`, `{ reading: 2 }` and `{ reading: 3 }`.
  - **`reports waiting, then done`:** resolve readings 1, 2 and 3 with `Response.json({ latin: "a" })`.
    - `onUpdate` gets `kind: "waiting"` twice, then `kind: "done"` once.
    - Nothing comes after done.
  - **`cuts off a straggler`:** resolve readings 1 and 2, then advance the timers by `STRAGGLER_MS`.
    - The last `onUpdate` is done, with `statuses[3]` `"failed"`.
    - Resolving reading 3 afterwards calls `onUpdate` no more.
  - **`stop drops every later reply`** (Review Focus 1): resolve reading 1, call `stop()`, then resolve 2 and 3 and run all timers.
    - `onUpdate` was called only for reading 1.
    - The fake fetch's signal is aborted.
  - **`reports an error when all fail`:** three 502 replies end with `kind: "error"`.

- [ ] **Step 2: Run `npx vitest run app/run-readings.test.ts`.** Expected: FAIL, with the module not found.

- [ ] **Step 3: Implement `runReadings`.** Move the logic of today's `run()` in `app/transliterator.tsx` here unchanged:
  - the `Run` record
  - the identity and settled guard
  - `firstBackAt` set on the first ok reply
  - the timer armed once
  - settling with `text.split(/\r?\n/).length`

  `stop()` aborts the controller, clears the timer, and makes every later reply or timer a no-op.

- [ ] **Step 4: Refactor `Transliterator` and `OutputPanel`.**
  - `run()` validates and computes the skeleton rows as today, then calls `runReadings`, mapping each `Settled` onto today's phases. A ref holds the `stop` function, and `stopRun()` calls it.
  - Choices move from `OutputPanel` state to `Transliterator` state, reset on each new run.
  - **One `recordChoice(part: number, line: number, span: Span, chosenIndex: number)` in `Transliterator`.** For a short paste the part is 1. Move the section 8 comment there, and mention the part number.
  - `OutputPanel` takes `choices` and `onPick` as props. Its markup is otherwise unchanged.

- [ ] **Step 5: Run `npm test` and `npm run build`.** Expected: both pass.

- [ ] **Step 6: Browser regression check.** In headless Chrome at 390px and 1280px, with stubbed replies, re-run the three-readings flows:
  - waiting dots
  - marks
  - choosing and changing a choice
  - Copy after choosing
  - all agree
  - one failed
  - all failed, then Try again
  - straggler cut-off
  - Clear mid-run
  - two examples pressed in quick succession

  Everything must behave as before. The harness from the last feature is at `/private/tmp/claude-501/-Users-mark-workplace-coptish-coptish-transliterator/0a0c67f4-5af6-4fdd-bb60-75e498fad808/scratchpad/pw/`. `lib.mjs` and `checks.mjs` show how pages are launched and stubbed. Reuse them, and point them at whichever port you serve on.

- [ ] **Step 7: Commit** the four files, with the message `Move a run of three readings into a helper and lift choices up`.

---

### Task 3: Counter, labels and the folded row's text

**Files:**
- Modify: `app/view-helpers.ts`, `app/view-helpers.test.ts`, `app/composer.tsx`, `lib/merge-readings.ts`, `lib/merge-readings.test.ts`

**Interfaces:**
- Consumes:
  - `splitParts` and `MAX_PASTE_LENGTH` (Task 1)
  - `Merged` (`lib/merge-readings.ts`)
- Produces:
  ```ts
  // app/view-helpers.ts
  export type CounterState = { visible: boolean; over: boolean; label: string; parts: number };
  export function counterState(text: string): CounterState;
  export function foldedLabel(partText: string, merged: Merged, chosen: number): string; // without the "Part N · " prefix
  // lib/merge-readings.ts
  export function spanCount(merged: Merged): number;
  export function isIncomplete(merged: Merged, inputLineCount: number): boolean; // merged.lines.length !== inputLineCount
  ```

- [ ] **Step 1: Write the failing tests.** In `app/view-helpers.test.ts`, replace the counter tests:
  - `counterState(a(4000))` is `{ visible: false, over: false, label: "4,000 / 16,000", parts: 1 }`.
  - `counterState(a(9000))` has `visible: true`, `over: false`, `label: "9,000 / 16,000 · 3 parts"` and `parts: 3`. It has no spaces, so the parts are hard cuts.
  - `counterState(a(16001))` has `visible: true`, `over: true` and `label: "16,001 / 16,000"`, with no parts suffix over the limit.
  - It still measures after trimming.

  Add `foldedLabel`, using `mergeReadings` to build each `merged`:

  | Part text | Merged | Chosen | Expected |
  |---|---|---|---|
  | 3 stanzas (2 blank lines) | 2 spans, 3 readings | 1 | `"3 stanzas · 1 of 2 chosen"` |
  | 1 stanza of 4 lines | no spans, 3 readings | 0 | `"4 lines · all agree"` |
  | one line of 5 words | no spans, readings `[1, 3]` | 0 | `"5 words · 2 of 3 readings came back"` |
  | 1 stanza | — | — | uses the singular, `"1 stanza · …"` |
  | 2 lines, merged with 1 line (incomplete) | the fallback | 0 | `"2 lines · lines may be missing"` |

  In `lib/merge-readings.test.ts`:
  - `spanCount` counts the spans on every line.
  - `isIncomplete` is true for the fallback when no reading had the right line count, and false for a normal merge.

- [ ] **Step 2: Run `npx vitest run app/view-helpers.test.ts lib/merge-readings.test.ts`.** Expected: the new tests fail.

- [ ] **Step 3: Implement.**
  - **`counterState`:**
    - `visible` when the trimmed length is over `MAX_INPUT_LENGTH`
    - `over` when it's over `MAX_PASTE_LENGTH`
    - `parts` is `splitParts(trimmed).length` when not over, otherwise 1
    - the label adds ` · N parts` only when `parts > 1`
  - **`foldedLabel`:**
    - **Size:** stanzas when the part has blank lines (count the blocks split on `/\n\s*\n/`), otherwise lines when there's more than one, otherwise words. Use the singular for 1.
    - **Summary:**
      - incomplete: `lines may be missing`
      - spans present: `k of N chosen`
      - no spans and 3 readings merged: `all agree`
      - otherwise: `M of 3 readings came back`
  - **Composer:** the primary button reads `Transliterate part 1` when `counter.parts > 1`. Nothing else changes.
  - **OutputPanel:** switch its inline span count to `spanCount`.

- [ ] **Step 4: Run `npm test` and `npm run build`.** Expected: both pass.

- [ ] **Step 5: Commit** the five files, plus `app/output-panel.tsx` if touched, with the message `Count parts in the counter and label folded parts`.

---

### Task 4: The walk-through

**Files:**
- Create: `app/part-body.tsx`, `app/hymn-panel.tsx`
- Modify: `app/output-panel.tsx`, `app/transliterator.tsx`
- Docs: `docs/superpowers/specs/2026-10-18-page-redesign-design.md` (Input box and Output sections, one pointer line each)

**Interfaces:**
- Consumes:
  - `splitParts`, `joinParts`, `Part`, `MAX_PASTE_LENGTH` and `validateInput(raw, limit)` (Task 1)
  - `runReadings` and `recordChoice(part, line, span, idx)` (Task 2)
  - `foldedLabel`, `spanCount` and `isIncomplete` (Task 3)
  - `mergedText`, `MergedText`, `ReadingDots` and `readingsNote` (existing)
- Produces:
  ```ts
  // app/part-body.tsx — what sits under a header: skeleton (+ 8 s hint) while loading; merged text + note when done
  export function PartBody(props: { phase: Extract<PartPhase, { kind: "loading" | "done" }>; choices: Choices; onPick: (line: number, span: Span, chosenIndex: number) => void }): JSX.Element;
  export type PartPhase =
    | { kind: "loading"; rows: number[]; statuses: Statuses }
    | { kind: "done"; merged: Merged; statuses: Statuses }
    | { kind: "error"; message: string; retryable: boolean };
  // app/hymn-panel.tsx — the output for a paste of more than one part
  export function HymnPanel(props: {
    parts: readonly { part: Part; lineCount: number; phase: PartPhase | null; choices: Choices; open: boolean }[];
    current: number; finished: boolean;
    onNext(): void; onFinish(): void; onRetry(index: number): void; onToggle(index: number): void; onShowAll(): void; onFoldAll(): void;
    onPick(part: number, line: number, span: Span, chosenIndex: number): void;
  }): JSX.Element;
  ```

- [ ] **Step 1: Load the `design-taste-frontend` skill.** Open the approved mockup, and read spec section 6 in full.

- [ ] **Step 2: Extract `PartBody` from `OutputPanel`.** Move the skeleton, the 8-second hint, `MergedText` and the note into it. `OutputPanel` renders its header, then `PartBody`. Short pastes must render pixel-for-pixel as before.

- [ ] **Step 3: Walk-through state in `Transliterator`.**
  - **Validation:** `run(raw)` validates with `validateInput(raw, MAX_PASTE_LENGTH)`, then calls `splitParts`.
  - **One part:** today's path, through `OutputPanel`.
  - **More than one part:** keep `{ parts, current: 0, finished: false }` and start part 0 with `runReadings`.
  - **Next part:** close the current part (`open: false`), set `current + 1`, and start that part.
  - **Finish:** close the last part and set `finished`.
  - **Retry `i`:** re-run part `i` with fresh choices. A failed or incomplete part has no marks to lose.
  - **Toggle `i`:** flip `open`.
  - **Show all and fold all:** set every `open`.
  - **Leaving a walk-through:** a new run, Clear or an example press calls the current `stop()` and discards the walk-through. Editing the box doesn't, because the parts were fixed when the walk-through started.
  - **Composer `busy`:** true while the current part is loading and the box still holds the text that started the walk-through.
  - **Scrolling:** apply today's rule when a part starts, not on every reply.

- [ ] **Step 4: `HymnPanel`, following spec section 6 and the mockup.**
  - **Header:**
    - the ink rule
    - the label: `Latin`, or `Latin · whole hymn` once every part is done
    - `Copy all` once any part is done
    - Copy all copies `joinParts` over the done parts in order, using `mergedText(merged, choices)`, including the part on screen
  - **Folded rows:** each row is 48px, reading `Part N · ${foldedLabel(...)}`, with `Show` or `Hide`.
  - **The open current part:**
    - a hairline row labelled `Part N of M`, with `ReadingDots` while loading, then `PartBody`
    - when done, `Next part` with the arrow icon, or `Finish` on the last part. Both are always enabled: settling marks is optional
    - when done and incomplete, the note `Some lines may be missing from this part` with `Try again`
    - when the part errored, today's alert markup under the row, with `Try again` when retryable
  - **Reopened parts** render a full `PartBody`. The mockup's "… 26 more stanzas" is only shorthand.
  - **Finished:** `All N parts done`, then `Show the whole hymn`. Once all are open, that button reads `Fold all`.

- [ ] **Step 5: Run `npm test` and `npm run build`.** Expected: both pass.

- [ ] **Step 6: Browser checks** at 390px and 1280px, with stubbed replies, on the 9,000-character test hymn.
  - A short paste is unchanged.
  - A long paste's counter and button.
  - Part 1, then Next part with nothing chosen.
  - **Review Focus 2:**
    1. Choose in part 1.
    2. Press Next part.
    3. Show part 1: the choice is still there.
    4. Hide it.
    5. Finish, then Show the whole hymn, then Fold all.
    6. Copy all contains the choice.
  - Copy all on part 1 alone.
  - A failed part, then Try again.
  - An incomplete part: stub a reply with fewer lines.
  - Pressing Transliterate again mid-part, Clear mid-part, and an example press mid-part. Each time, no old reply may land (Review Focus 1).
  - Keyboard use through Next part, Show and Hide.
  - Reduced motion.

  Save screenshots in the plan's workspace. List any check that can't be scripted.

- [ ] **Step 7: Add the pointer lines to the redesign spec.** Commit the four app files and the spec, with the message `Walk through long hymns part by part, with folding parts`.

---

### Task 5: The real run and close-out

**Files:**
- Docs: `docs/superpowers/specs/2026-10-18-long-hymns-design.md` (status line, and a "Measured" line under section 7)

- [ ] **Step 1: Run `npm test` and `npm run build`.** Expected: both pass.

- [ ] **Step 2: Get the user's example hymn.** That's tasbeha.org hymn 1286. Rebuild its Coptic text from the page's `sync-para` and `sync-line` blocks, joining a line's `sync-coptic` words with spaces, lines with `\n` and stanzas with `\n\n`. Expect about 9,000 code points, 81 stanzas and 324 lines. Keep it in a scratch file outside the repo: don't commit it.

- [ ] **Step 3: Do one real run** with `npx next start -p 3100` on the fresh build. Paste the hymn at 390px, then walk through all 3 parts with Next part and Finish. That's 9 Gemini requests.
  - For each part, record:
    - its length
    - its time from press to text
    - each reading's line count against the part's
    - whether it's incomplete
  - Confirm that Copy all gives 81 stanzas.
  - Stop the server.

- [ ] **Step 4: Apply the stop rule from spec section 7.**
  - **If any part came back incomplete,** stop. Don't tune part sizes, and don't mark the spec implemented. Report the numbers. The controller takes them to the user.
  - **Otherwise,** add the "Measured" line under section 7, set the status to `Implemented (approved by the user on 2026-10-18)`, and commit with the message `Record the long-hymn run and mark the design implemented`.

- [ ] **Step 5: Don't merge or push.** Merging to `main` and pushing deploys the site, which is the user's call.
