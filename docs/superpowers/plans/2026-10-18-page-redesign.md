# Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the page from scratch so it matches `DESIGN.md` and the approved prototype, and raise the input limit so a 500-word paste works end to end.

**Architecture:**
- **Server side:** the API contract is unchanged. Only the input limit and the output-token budget grow.
- **Client side:** `requestTransliteration` gains an `AbortSignal` and marks which errors are worth retrying.
- **Pure logic:** examples, skeleton shape, counter state and line delays live in small modules tested in Vitest's node environment.
- **The page:** a server `page.tsx` renders the heading and a client `Transliterator`. That component owns all state and composes three presentational components: `Composer`, `OutputPanel` and `ExampleList`. Design tokens live in Tailwind v4's `@theme`.

**Tech Stack:** Next.js 16.4.2 (App Router), React 19.3.1, TypeScript 5, Tailwind CSS 4, `next/font`, Vitest 4, Node 20.19.2.

**Spec:** `docs/superpowers/specs/2026-10-18-page-redesign-design.md`, plus the approved prototype next to it, `docs/superpowers/specs/2026-10-18-page-redesign-prototype.html`. Section 5 of the spec holds every measurement. This plan doesn't repeat them.

## Global Constraints

- **Colors:** only `#141413` (ink), `#faf9f5` (paper) and `#ffffff` (white), plus ink at 60%, 12% and 6% opacity. No red and no accent colors.
- **Theme:** light only. No `dark:` variants.
- **Motion:** durations 100 / 200 / 800ms. Easing `cubic-bezier(0.16, 1, 0.3, 1)`. One breakpoint at 768px (Tailwind `md`). Radii 8 / 16 / 24px.
- **Fonts:** Hanken Grotesk 400/500/700 (sans), JetBrains Mono 400 (mono), and the local CS Ava Veni for Coptic.
- **Accessibility:**
  - Every interactive element is at least 44×44px.
  - Focus shows a 2px ink outline with a 2px offset.
  - Under `prefers-reduced-motion`: near-instant transitions, no pulse, no stagger, instant scroll.
- **Input limit:** `MAX_INPUT_LENGTH` = 4,000 code points, counted as `[...text].length` after trimming.
- **Layout:** no navbar and no footer.
- **Copy, verbatim:**
  - Headline: `Read Coptic aloud.`
  - Subline: `Paste Bohairic Coptic and get it back in Latin letters, spelled the way it’s said in church.`
  - Placeholder: `Paste or type Coptic text`
  - Hidden label: `Coptic text`
  - Shortcut hint: `⌘ Enter` on Apple devices, `Ctrl Enter` elsewhere
  - Buttons: `Clear`, `Transliterate`, and `Transliterating` while loading
  - Examples heading: `No Coptic on hand? Try one.`
  - Output label: `Latin`
  - Copy button: `Copy`, then `Copied`
  - Long wait: `Longer passages can take up to a minute.`
  - Retry link: `Try again`
- **Error wording:** keep the existing messages from the server and from `app/request-transliteration.ts`.
- **Next.js:** this version differs from what you know (`AGENTS.md`). Before writing Next code, read the relevant guide in `node_modules/next/dist/docs/`. For fonts, read `01-app/01-getting-started/13-fonts.md` and `01-app/03-api-reference/02-components/font.md`.
- **UI skill:** the user asked for the `design-taste-frontend` skill. Load it before writing UI (Tasks 4 and 5).
- **Imports:** use the `@/` alias.
- **Git:**
  - Stage explicit paths only, never `git add -A` or `git add .`.
  - End every commit message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
  - If the sandbox blocks writes inside `.git`, ask the user to run the commit with the `!` prefix.
- **Secrets:** never read `.env.local`.

## Review Focus

1. **A late reply after a newer request.** For example, someone taps one example and then another before the first returns. The first reply must never replace the second. Pinned in Task 2: a reply that arrives after its signal was aborted is reported as `aborted`.
2. **A whole prayer pasted as one long line.** The skeleton must show several full bars and a shorter last one, not a single bar. Pinned in Task 3.
3. **Windows line endings and blank lines around the paste.** These must not add skeleton rows. Pinned in Task 3.
4. **Hidden buttons reached by keyboard or screen reader.** While the box is empty, the hint, Clear and Transliterate must not be focusable or announced. Pinned in Task 5, step 6.
5. **The clipboard is unavailable or permission is denied.** Copy must never show `Copied` falsely. Instead it selects the Latin so the user can copy it by hand. Pinned in Task 5, step 6.

---

### Task 1: Raise the input limit to 4,000 code points

**Files:**
- Modify: `lib/validate.ts:1`, `lib/validate.test.ts:19-34`
- Modify: `lib/gemini.ts:23-25`, `lib/gemini.test.ts:142-148`
- Modify: `docs/superpowers/specs/2026-10-17-coptic-transliterator-design.md`, lines 28, 84, 100, 137, 139, 162–174, 180, 277, 290–291

**Interfaces:**
- Consumes: nothing.
- Produces: `MAX_INPUT_LENGTH === 4000`, exported from `@/lib/validate`. Task 3 uses it.

- [ ] **Step 1: Update the tests**

In `lib/validate.test.ts`, rename the length test and change its last assertion. Make the jinkim test scale with the limit.

```ts
it("accepts exactly 4,000 code points and rejects 4,001", () => {
  expect(MAX_INPUT_LENGTH).toBe(4000);
  // ...existing two assertions...
  if (!tooLong.ok) expect(tooLong.message).toContain("4001");
});

it("counts combining marks such as the jinkim as characters", () => {
  const withJinkim = "ⲛ̀"; // ⲛ̀ is two code points
  expect(validateInput(withJinkim.repeat(MAX_INPUT_LENGTH / 2)).ok).toBe(true);
  expect(validateInput(withJinkim.repeat(MAX_INPUT_LENGTH / 2) + COPTIC_LETTER).ok).toBe(false);
});
```

In `lib/gemini.test.ts`, replace the `maxOutputTokens` test:

```ts
it("is 64 plus twice the input length, capped at 8,192", () => {
  expect(maxOutputTokens("ⲁ")).toBe(66);
  expect(maxOutputTokens("ⲁ".repeat(4000))).toBe(8064);
  expect(maxOutputTokens("ⲁ".repeat(4064))).toBe(8192);
  expect(maxOutputTokens("ⲁ".repeat(5000))).toBe(8192);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -- lib/validate.test.ts lib/gemini.test.ts`
Expected: FAIL. The limit test sees 1000, and `maxOutputTokens` returns 2048.

- [ ] **Step 3: Implement**

Set `MAX_INPUT_LENGTH = 4000` in `lib/validate.ts`. In `lib/gemini.ts`, change the cap in `maxOutputTokens` from 2048 to 8192.

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Update the old spec**

In `docs/superpowers/specs/2026-10-17-coptic-transliterator-design.md`:
- **Line 28:** `Up to 4,000 code points per request (raised from 1,000 by the 2026-10-18 page redesign)`.
- **Line 100:** `over 4,000`.
- **Line 180:** `the 4,000 limit`.
- **Line 137:** `` `maxOutputTokens` = 64 + 2 × the input length, capped at 8,192 ``.
- **Lines 84, 139 and 277, and the iteration 3 row (line 290):** the planned server-side Gemini abort goes from 25 to 55 seconds, so it fits inside the 60-second `maxDuration`.
- **The rest of the iteration 3 row:** remove "client-side validation" and "cancelling on resubmit". The redesign delivers both.
- **Section 8 (lines 162–174):** replace its body with one line: `Replaced by docs/superpowers/specs/2026-10-18-page-redesign-design.md.`
- **The iteration 4 row (line 291):** `Delivered by the 2026-10-18 page redesign, which drops dark mode and the side-by-side layout.`

- [ ] **Step 6: Commit**

```bash
git add lib/validate.ts lib/validate.test.ts lib/gemini.ts lib/gemini.test.ts docs/superpowers/specs/2026-10-17-coptic-transliterator-design.md
git commit -m "Raise the input limit to 4,000 code points and the output budget to match" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Make requests cancellable and mark retryable errors

**Files:**
- Modify: `app/request-transliteration.ts`, `app/request-transliteration.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export type ClientResult =
  | { ok: true; latin: string }
  | { ok: false; aborted: false; message: string; retryable: boolean }
  | { ok: false; aborted: true };

export function requestTransliteration(
  text: string,
  fetchImpl?: typeof fetch,
  signal?: AbortSignal,
): Promise<ClientResult>;
```

- [ ] **Step 1: Update the existing tests and add new ones**

Existing error expectations gain `aborted: false` and a `retryable` value:
- `invalid_input` → `retryable: false`.
- 429, upstream 502, the HTML 504 page, a network failure, and a 200 without `latin` → `retryable: true`.

New tests:

```ts
it("passes the abort signal to fetch", async () => {
  const fetchImpl = respondWith(Response.json({ latin: "Amin" }));
  const { signal } = new AbortController();
  await requestTransliteration("Ⲁⲙⲏⲛ", fetchImpl, signal);
  expect(fetchImpl).toHaveBeenCalledWith("/api/transliterate", expect.objectContaining({ signal }));
});

it("reports a cancelled request as aborted, not as an error", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("Aborted", "AbortError"));
  await expect(requestTransliteration("Ⲁⲙⲏⲛ", fetchImpl, controller.signal))
    .resolves.toEqual({ ok: false, aborted: true });
});

// Review Focus 1
it("reports a reply that arrives after cancelling as aborted", async () => {
  const controller = new AbortController();
  const fetchImpl = vi.fn<typeof fetch>(async () => {
    controller.abort();
    return Response.json({ latin: "Amin" });
  });
  await expect(requestTransliteration("Ⲁⲙⲏⲛ", fetchImpl, controller.signal))
    .resolves.toEqual({ ok: false, aborted: true });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -- app/request-transliteration.test.ts`
Expected: FAIL. There's no `retryable` or `aborted` yet, and no `signal` is passed.

- [ ] **Step 3: Implement**

- Pass `signal` in the fetch options.
- After each `await`, and in each `catch`, return `{ ok: false, aborted: true }` when `signal?.aborted`.
- Only the `invalid_input` branch is `retryable: false`.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm test -- app/request-transliteration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/request-transliteration.ts app/request-transliteration.test.ts
git commit -m "Let transliteration requests be cancelled and mark retryable errors" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Examples and view helpers

**Files:**
- Create: `app/examples.ts`, `app/examples.test.ts`, `app/view-helpers.ts`, `app/view-helpers.test.ts`

**Interfaces:**
- Consumes: `MAX_INPUT_LENGTH` from `@/lib/validate` (Task 1).
- Produces:

```ts
// app/examples.ts
export type Example = { id: "risen" | "name" | "prayer" | "conclusion"; title: string; coptic: string };
export const EXAMPLES: readonly Example[];

// app/view-helpers.ts
export const SKELETON_MAX_ROWS = 40;
/** Bar widths in percent, one per output row; 0 is a blank row. */
export function skeletonRows(text: string, charsPerRow: number): number[];
export type CounterState = { visible: boolean; over: boolean; label: string };
export function counterState(text: string): CounterState;
export function lineDelayMs(index: number): number;
```

- [ ] **Step 1: Write the failing tests**

`app/examples.test.ts` imports `reference from "@/data/reference.json"`:

```ts
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
```

`app/view-helpers.test.ts`:

```ts
const a = (n: number) => "ⲁ".repeat(n);

describe("skeletonRows", () => {
  it("gives one bar per line, as wide as the line relative to the longest", () => {
    expect(skeletonRows(`${a(20)}\n${a(10)}`, 50)).toEqual([100, 50]);
  });
  it("gives a blank row for a blank line", () => {
    expect(skeletonRows(`${a(2)}\n\n${a(2)}`, 50)).toEqual([100, 0, 100]);
  });
  it("never draws a bar narrower than 28%", () => {
    expect(skeletonRows(`${a(20)}\n${a(1)}`, 50)).toEqual([100, 28]);
  });
  // Review Focus 2
  it("wraps a line longer than a row into full bars and a shorter one", () => {
    expect(skeletonRows(a(120), 50)).toEqual([100, 100, 40]);
  });
  // Review Focus 3
  it("ignores Windows line endings and blank lines around the text", () => {
    expect(skeletonRows(`\r\n ${a(4)}\r\n${a(2)} \r\n\r\n`, 50)).toEqual([100, 50]);
  });
  it("stops at 40 rows", () => {
    expect(skeletonRows(`${a(1)}\n`.repeat(60), 50)).toHaveLength(SKELETON_MAX_ROWS);
  });
});

describe("counterState", () => {
  it("stays hidden below 80% of the limit", () => {
    expect(counterState(a(3199)).visible).toBe(false);
  });
  it("shows a formatted count from 3,200", () => {
    expect(counterState(a(3200))).toEqual({ visible: true, over: false, label: "3,200 / 4,000" });
  });
  it("marks text over the limit", () => {
    expect(counterState(a(4001))).toEqual({ visible: true, over: true, label: "4,001 / 4,000" });
  });
  it("counts code points after trimming, combining marks included", () => {
    expect(counterState(`  ${"ⲛ̀".repeat(1600)}\n`).label).toBe("3,200 / 4,000");
  });
});

describe("lineDelayMs", () => {
  it("staggers lines by 40ms and caps at 480ms", () => {
    expect([0, 1, 12, 40].map(lineDelayMs)).toEqual([0, 40, 480, 480]);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -- app/examples.test.ts app/view-helpers.test.ts`
Expected: FAIL, because the modules don't exist yet.

- [ ] **Step 3: Write `app/examples.ts`**

Use the Coptic from `data/reference.json`, joined with `\n`:
- `risen`: the first pair as is.
- `name`: the four pairs starting `Ϧⲉⲛ ⲫ̀ⲣⲁⲛ ⲙ̀ⲫ̀ⲓⲱⲧ`.
- `prayer`: the seven held-out pairs from `Ϫⲉ ⲡⲉⲛⲓⲱⲧ` through `ⲛⲉⲙ ⲡⲓⲱⲟⲩ ϣⲁ ⲉⲛⲉϩ. Ⲁⲙⲏⲛ.`
- `conclusion`: the four pairs from `Ϩⲓⲧⲉⲛ ⲛⲓⲡ̀ⲣⲉⲥⲃⲓⲁ:` through `ⲙ̀ⲡⲓⲭⲱ ⲉ̀ⲃⲟⲗ ⲛ̀ⲧⲉ ⲛⲉⲛⲛⲟⲃⲓ.`

The prototype's `EXAMPLES` object has the same texts. It's a convenient source to copy from, but the test against `reference.json` is the check.

- [ ] **Step 4: Write `app/view-helpers.ts`**

- `counterState`: `n = [...text.trim()].length`. It is visible when `n >= MAX_INPUT_LENGTH * 0.8` and over when `n > MAX_INPUT_LENGTH`. Format the label with `toLocaleString("en-US")`.
- `lineDelayMs(i)`: `Math.min(i * 40, 480)`.
- `skeletonRows`: the signature and tests don't determine the algorithm, so use this one.

```ts
const lines = text.trim().split(/\r?\n/).map((line) => [...line.trim()].length);
const perRow = Math.max(1, charsPerRow);
const widest = Math.min(Math.max(...lines, 1), perRow);
const rows: number[] = [];
for (const length of lines) {
  if (length === 0) rows.push(0);
  else {
    const fullRows = Math.floor((length - 1) / perRow);
    for (let i = 0; i < fullRows; i++) rows.push(100);
    const rest = length - fullRows * perRow;
    rows.push(Math.max(28, Math.min(100, Math.round((rest / widest) * 100))));
  }
  if (rows.length >= SKELETON_MAX_ROWS) break;
}
return rows.slice(0, SKELETON_MAX_ROWS);
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/examples.ts app/examples.test.ts app/view-helpers.ts app/view-helpers.test.ts
git commit -m "Add the page's examples and the skeleton, counter and stagger helpers" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Design tokens and fonts

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`. Both already hold the uncommitted CS Ava Veni swap; keep it.
- Commit: `app/fonts/CSAvaVeni-Regular.ttf`, `DESIGN.md` and `AGENTS.md`, all currently untracked. The user confirmed the font may be published.

**Interfaces:**
- Consumes: nothing.
- Produces Tailwind utilities for Task 5:
  - colors: `bg-paper`, `text-ink`, `border-ink`, `text-ink/60`, `border-ink/12`, `bg-ink/6`
  - fonts: `font-sans`, `font-mono`, `font-coptic`
  - radii: `rounded-sm` (8px), `rounded-md` (16px), `rounded-lg` (24px)
  - shadow: `shadow-card`
  - easing: `ease-brand`
  - animations: `animate-bar-pulse`, `animate-line-rise`
  - the next/font variables `--font-hanken-grotesk`, `--font-jetbrains-mono` and `--font-cs-ava-veni` on `<html>`

- [ ] **Step 1: Read the Next.js font guides** listed in Global Constraints. Load the `design-taste-frontend` skill.

- [ ] **Step 2: Load the fonts in `app/layout.tsx`**

- Load `Hanken_Grotesk` with weights `["400", "500", "700"]` and variable `--font-hanken-grotesk`.
- Load `JetBrains_Mono` with weight `"400"` and variable `--font-jetbrains-mono`.
- Both come from `next/font/google`, with `subsets: ["latin"]`.
- Put all three variables on `<html lang="en">`.
- `<body>` gets `bg-paper text-ink font-sans antialiased`.
- Keep the metadata as it is.

- [ ] **Step 3: Write the tokens in `app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-ink: #141413;
  --color-paper: #faf9f5;
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --shadow-card: rgba(0, 0, 0, 0.01) 0px 2px 2px 0px, rgba(0, 0, 0, 0.02) 0px 4px 4px 0px, rgba(0, 0, 0, 0.04) 0px 16px 24px 0px;
  --ease-brand: cubic-bezier(0.16, 1, 0.3, 1);
  --animate-bar-pulse: bar-pulse 1.6s ease-in-out infinite;
  --animate-line-rise: line-rise 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
  @keyframes bar-pulse { 50% { opacity: 0.14; } }
  @keyframes line-rise { from { opacity: 0; transform: translateY(4px); } }
}

@theme inline {
  --font-sans: var(--font-hanken-grotesk), Arial, sans-serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, monospace;
  --font-coptic: var(--font-cs-ava-veni), var(--font-hanken-grotesk), sans-serif;
}
```

Also add:
- a base rule giving `:focus-visible` a 2px solid ink outline with a 2px offset
- a `prefers-reduced-motion: reduce` rule that sets every animation and transition duration to 1ms, `animation-iteration-count: 1` (otherwise the infinite skeleton pulse would flicker at 1ms), and `scroll-behavior: auto`

- [ ] **Step 4: Check the build and the body**

Run `npm run build`; expected to succeed. Then run `npm run dev` and open http://localhost:3000. The body's computed background is `rgb(250, 249, 245)` and its font family starts with the Hanken Grotesk variable. The old markup still renders on top; Task 5 replaces it.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx app/fonts/CSAvaVeni-Regular.ttf DESIGN.md AGENTS.md
git commit -m "Add DESIGN.md tokens, Hanken Grotesk, JetBrains Mono and the CS Ava Veni Coptic font" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The page

**Files:**
- Rewrite: `app/page.tsx` (server component: `<main>` with the heading, subline and `<Transliterator />`)
- Rewrite: `app/transliterator.tsx` (client component: state, request flow, workspace grid, error line)
- Create:
  - `app/composer.tsx`
  - `app/output-panel.tsx`
  - `app/example-list.tsx`
  - `app/icons.tsx` (`ArrowRightIcon`, `CopyIcon` and `AlertIcon`: 16px, 1.5px stroke, `aria-hidden`)

**Interfaces:**
- Consumes:
  - `requestTransliteration` and `ClientResult` (Task 2)
  - `EXAMPLES` and `Example` (Task 3)
  - `skeletonRows`, `counterState` and `lineDelayMs` (Task 3)
  - `validateInput` from `@/lib/validate`
  - the Task 4 utilities
- Produces:

```ts
// app/transliterator.tsx
type Phase =
  | { kind: "idle" }
  | { kind: "loading"; sentText: string; rows: number[] }
  | { kind: "done"; latin: string }
  | { kind: "error"; message: string; retryable: boolean };

// app/composer.tsx
export function Composer(props: {
  text: string;
  busy: boolean; // a request for exactly this text is running
  textareaRef: Ref<HTMLTextAreaElement>;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}): JSX.Element;

// app/output-panel.tsx (its own prop type, so it doesn't import from transliterator.tsx)
export function OutputPanel(props: {
  phase: { kind: "loading"; rows: number[] } | { kind: "done"; latin: string };
  ref?: Ref<HTMLElement>;
}): JSX.Element;

// app/example-list.tsx
export function ExampleList(props: {
  selectedId: Example["id"] | null;
  onPick: (example: Example) => void;
}): JSX.Element;
```

- [ ] **Step 1: Read the guides.** Load the `design-taste-frontend` skill and read the Next.js docs on Server and Client Components. Open the prototype in a browser and keep it beside you for the rest of the task.

- [ ] **Step 2: Build `Composer`, `ExampleList` and `OutputPanel`**

Follow spec section 5 for every size, spacing and motion value.

**`Composer`:**
- Counter: rendered from `counterState(text)`.
- Shortcut hint, Clear and Transliterate: shown only when `text.trim() !== ""`. When hidden, set `inert` on them as well as hiding them visually (Review Focus 4).
- Shortcut hint label: set after mount with `/Mac|iPhone|iPad/.test(navigator.userAgent)`.
- Ctrl/Cmd+Enter in the textarea calls `onSubmit`.
- Transliterate button: disabled with the `Transliterating` label and animated dots while `busy`.

**`OutputPanel`:**
- **Loading:** renders one bar per `rows` entry, with `animationDelay` of `i * 80ms`. A width of 0 is an empty row. The whole skeleton is `aria-hidden`.
- **Long wait:** after 8,000ms of loading, it shows the long-wait line. Use a timer cleared on change.
- **Done:** splits the Latin on `/\r?\n/`. Each line is a block span with `animate-line-rise` and `animationDelay: lineDelayMs(i)`; an empty line keeps its height.
- **Copy:**
  - Use `navigator.clipboard.writeText` and show `Copied` for 1,600ms.
  - On a rejected or missing clipboard API, select the Latin element's text with a `Range` instead, and leave the label as `Copy` (Review Focus 5).
  - The button is hidden while loading.
- The section is `aria-live="polite"`, with `aria-busy` set while loading.

**`ExampleList`:**
- Uses `aria-pressed` on each button.
- Phone: pill buttons showing the title only.
- `md` and up: cards with the first Coptic line in `font-coptic`, cut off with an ellipsis.

- [ ] **Step 3: Write `Transliterator`**

It holds `text`, `selectedId` and `phase` state, and refs for the textarea, the output section, the current `AbortController` and the last text sent.

`run(raw)`:
1. Abort any request in flight.
2. Call `validateInput(raw)`. If it fails, set the phase to `error` with `retryable: false` and stop.
3. Store `raw` as the last text sent.
4. Create a new `AbortController`.
5. Set the phase to `loading` with `rows = skeletonRows(input.text, charsPerRow())`.
6. Await `requestTransliteration(input.text, fetch, signal)`.
7. On `aborted`, do nothing. Otherwise set the phase to `done` or `error`.

`charsPerRow()`: `Math.max(16, Math.floor(width / (fontPx * 0.5)))`, where `width` is the output column's `clientWidth`. `fontPx` is 26 when `matchMedia("(min-width: 768px)")` matches, otherwise 22.

Wiring:
- **Edit:** set `text`, and set `selectedId` to `null`.
- **Submit:** `run(text)`. Ignore it while `busy`.
- **Clear:** abort, set `text` to `""`, `selectedId` to `null` and the phase to `idle`, then focus the textarea.
- **Pick an example:** set `text` to its Coptic and `selectedId` to its id, then `run(example.coptic)`.
- **Try again:** `run(lastSent)`.
- `busy` = `phase.kind === "loading" && text === phase.sentText`.

Side effects:
- **On mount:** focus the textarea if `matchMedia("(pointer: fine)")` matches.
- **On unmount:** abort.
- **When the phase becomes `loading`:** scroll the output into view, with `block: "start"`. Do this on phone (`max-width: 767px`), or on desktop when the output's top is below `innerHeight`. Use behavior `"auto"` under reduced motion, otherwise `"smooth"`.

Error line:
- under the composer, with `role="alert"`
- `AlertIcon`, then the message
- a `Try again` text button only when `retryable`
- the output panel is hidden while the phase is `error`

Layout:
- grid with the composer, error and output in column 1, and `ExampleList` in column 2 at `md`
- on phone, examples come after the output
- the rail is sticky

- [ ] **Step 4: Rewrite `app/page.tsx`** with the heading and subline copy from Global Constraints. There is no other chrome.

- [ ] **Step 5: Type-check and test**

Run: `npm run build && npm test`
Expected: both succeed.

- [ ] **Step 6: Check the page in a browser against the prototype**

Run `npm run dev`. Check at 390px and at 1280px wide (use the `run` skill or Claude in Chrome), and confirm each of these:
- [ ] The empty state matches the prototype. The shortcut hint, Clear and Transliterate can't be reached with Tab, and aren't in the accessibility tree.
- [ ] Typing reveals them with the 200ms rise. Emptying the box hides them again.
- [ ] An example press fills the box, shows a skeleton shaped like its lines, then fades the Latin in line by line. On phone, the output scrolls into view.
- [ ] Pasting the Lord's Prayer as one line gives several bars in the skeleton.
- [ ] Editing mid-request re-enables Transliterate, and pressing it replaces the request. Pressing a second example mid-request shows only the second result.
- [ ] Clear during loading, and Clear after a result, both empty everything and focus the box.
- [ ] Copy puts the Latin, with its line breaks, on the clipboard. With clipboard permission blocked in DevTools, Copy selects the text and never shows `Copied`.
- [ ] A paste over 4,000 code points shows the counter in its over state and the server-format message, with no request in the Network tab.
- [ ] A Latin-only paste shows the not-Coptic message, with no request sent.
- [ ] With the dev server's `GEMINI_API_KEY` unset (or with the request blocked in DevTools), the error line shows `Try again`, and pressing it re-runs.
- [ ] The whole flow works with the keyboard alone.
- [ ] With reduced motion emulated in DevTools, nothing animates and scrolling is instant.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/transliterator.tsx app/composer.tsx app/output-panel.tsx app/example-list.tsx app/icons.tsx
git commit -m "Rebuild the page to match DESIGN.md: one input box, examples, skeleton output" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Prove a 500-word request works, and close out

**Files:**
- Modify: `docs/superpowers/specs/2026-10-18-page-redesign-design.md` (status, and the measured result in section 6)
- Possibly modify: `lib/gemini.ts` and `lib/gemini.test.ts`, only if step 3 shows truncation

**Interfaces:**
- Consumes: everything above.
- Produces: nothing new.

- [ ] **Step 1: Build a payload of about 3,950 code points**

Write it into the session scratchpad, with `SCRATCH` set to that directory's absolute path:

```bash
node -e '
const ref = require("./data/reference.json");
const lines = ref.flatMap((p) => p.coptic.split("\n"));
const out = []; let n = 0;
for (let i = 0; n < 3900; i++) { const l = lines[i % lines.length]; out.push(l); n += [...l].length + 1; }
process.stdout.write(JSON.stringify({ text: out.join("\n") }));
' > "$SCRATCH/long.json"
```

- [ ] **Step 2: Send it to the real API**

Start `npm run dev`, then run:

```bash
curl -s -o "$SCRATCH/long-out.json" -w "%{http_code} %{time_total}\n" \
  -H "content-type: application/json" --data @"$SCRATCH/long.json" http://localhost:3000/api/transliterate
```

Expected: `200` in under 60 seconds. The server log line shows `"code":"ok"` and its `ms`.

- [ ] **Step 3: Check that the answer is complete**

Compare the number of lines in `latin` with the input. They must be equal, and the last Latin line must match the last input line's transliteration in shape (not cut off mid-word).
- If the reply is a 502 or is truncated, thinking tokens are probably eating the budget. Raise the fixed part of `maxOutputTokens` (the `64`) until a re-run is complete, and update its test to match.
- If the request takes 60 seconds or more, **stop and tell the user**. Don't lower the limit.

- [ ] **Step 4: Run the full suite and the build**

Run: `npm test && npm run build`
Expected: both succeed.

- [ ] **Step 5: Record the result**

In the redesign spec:
- set `Status: Implemented`
- add to section 6 one line with the measured latency and line counts, for example `Measured 2026-10-18: 3,9xx code points → 200 in N s, M/M lines.`

- [ ] **Step 6: Commit**

Commit the spec, plus `lib/gemini.ts` and its test if step 3 changed them.

```bash
git add docs/superpowers/specs/2026-10-18-page-redesign-design.md
git commit -m "Record the 4,000-character end-to-end run and mark the redesign implemented" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
