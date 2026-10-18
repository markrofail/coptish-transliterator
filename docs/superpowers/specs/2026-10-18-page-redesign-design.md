# Page Redesign — Design

Date: 2026-10-18
Status: Implemented (approved by the user on 2026-10-18)

This document replaces section 8 (UI) of `2026-10-17-coptic-transliterator-design.md`. It also replaces that spec's "Input size" decision and the UI items in its iteration 4 row (Copy, counter, Ctrl/Cmd+Enter, side-by-side layout, dark mode). The API contract, prompt, model, and abuse protection are unchanged except where section 6 says otherwise.

## 1. Intent

The users are members of the public from church congregations. They copy a snippet of Coptic text, under 500 words, and want Latin text back that they can read aloud.

The current page is a default-looking form. The user wants it rebuilt from scratch, UI and UX, so it matches `DESIGN.md` (Anthropic's design tokens) faithfully, "as if Anthropic would build it". They mean the look and feel, not any particular Anthropic screen: minimal, restrained, warm off-white and near-black.

The user approved a clickable prototype during brainstorming: `docs/superpowers/specs/2026-10-18-page-redesign-prototype.html`. **The built page should look and behave like it**, except where this document says otherwise.

## 2. Goals, non-goals, anti-goals

**Goals**

- One focused screen: a big empty text box is the page.
- Faithful to `DESIGN.md`: its two colors, radii, shadows, motion durations and easing, 768px breakpoint, and focus and touch-target rules.
- Phone-first, and also comfortable on desktop.
- A paste of up to about 500 words works end to end.

**Non-goals**

- Navbar or footer (the user's decision). Later on 2026-10-18 the user asked for a nav bar: the Coptish logo, a "Transliterator" label, About and GitHub, plus an About page at `/about`. There's still no footer.
- Dark mode. The page is light only (the user's decision).
- Accent colors, including red for errors.
- Streaming output. The output arrives whole, after a skeleton.
- Any change to the prompt, the model, the reference set, or the evaluation.
- Carried over from the old spec: on-screen Coptic keyboard, history, saved texts, shareable links, accounts, dialect choice.

**Anti-goals:** the user named none ("it looks great"). The approved prototype is the bar.

## 3. Decided by the user

| Topic | Decision |
|---|---|
| Chrome | No navbar and no footer. The page is a big empty text box. |
| Transliterate button | Appears only once the box has text. |
| Examples | Beside the box, so someone with no Coptic on hand can try it. |
| Loading | Pressing an example or the button shows a skeleton of the output while the request runs. It fills in when the text arrives. |
| Clear | Empties the box, the output, and any error. |
| Input limit | Raise it so a 500-word paste works (section 6). |
| Font | Hanken Grotesk, with JetBrains Mono for small labels. These stand in for Anthropic Sans and Anthropic Mono, which aren't publicly licensed. |
| Theme | Light only. |
| Look and behavior | As in the approved prototype (v2). |

## 4. The prototype

Open `docs/superpowers/specs/2026-10-18-page-redesign-prototype.html` in a browser. It loads the Coptic font from `app/fonts/` and the Latin fonts from Google Fonts.

It's throwaway. Don't port its code wholesale.

- The output is canned for the four examples. Anything typed gets a crude letter-by-letter map.
- The dark pill at the bottom (Desktop / Phone / Simulate error) is a prototype control, not part of the design.
- It uses container queries so it can show a phone frame. The real page uses an ordinary `768px` media query.

Measurements below come from the prototype. Where the two disagree, this document wins.

## 5. The page

### Tokens

Set these as CSS custom properties in `app/globals.css`, exposed through Tailwind v4's `@theme`.

| Token | Value | Source |
|---|---|---|
| ink | `#141413` | DESIGN.md primary, text, border, surface |
| paper | `#faf9f5` | DESIGN.md background |
| white | `#ffffff` | DESIGN.md on-primary |
| ink-60 / ink-12 / ink-06 | `#141413` at 60%, 12%, 6% | my call: tints of ink for secondary text, hairlines and hovers, so the page stays two-color |
| radius sm / md / lg | 8 / 16 / 24px | DESIGN.md |
| shadow-card | DESIGN.md `card` value | DESIGN.md |
| fast / base / slow | 100 / 200 / 800ms | DESIGN.md |
| ease | `cubic-bezier(0.16, 1, 0.3, 1)` | DESIGN.md |
| sans | Hanken Grotesk, Arial, sans-serif | user's choice, DESIGN.md fallback |
| mono | JetBrains Mono, ui-monospace, monospace | user's choice |
| coptic | CS Ava Veni, then sans | existing local font (see section 7) |

Spacing uses DESIGN.md's scale: 2, 4, 8, 12, 16, 22, 58, 68.

**Type sizes (my call).** DESIGN.md's 12px body is used only for small mono labels. Reading text is larger, because people read the output aloud on phones.

| Role | Phone | Desktop (≥768px) |
|---|---|---|
| Headline | 40px, scaling up to 58px; 700; line height 1.1; −0.02em | 58px |
| Subline | 17px; ink-60; max width 44ch | 18px |
| Coptic input | 22px; line height 1.6 | same |
| Latin output | 22px; line height 1.55; −0.01em | 26px |
| Buttons and example titles | 15px; 500 | same |
| Labels, counter, shortcut hint | 12px mono; ink-60 | same |

### Layout

- Background is paper on the whole page. There is no other chrome.
- **Phone:** one column with 16px side gutters and 44px top padding. The order is: heading, input box, output (once there is one), examples.
- **Desktop (≥768px):** max width 1080px, 32px side padding, 68px top padding, and 58px between the heading and the workspace. The workspace has two columns: the input and output column (fills the space) and an examples rail (248px), 58px apart. The rail is sticky at 32px from the top.
- **Heading:** "Read Coptic aloud." with the subline "Paste Bohairic Coptic and get it back in Latin letters, spelled the way it's said in church." (my call on the copy). The page `<title>` stays "Coptic Transliterator".

### Input box

For a paste over 4,000 characters, the counter and the button now follow `2026-10-18-long-hymns-design.md`, section 6. The rest of this section still applies.

- One bordered container: 1px ink border, 16px radius, paper background. When anything inside has focus, it gets a 2px ink outline with a 2px offset.
- **Textarea:** borderless, `lang="cop"`, spellcheck off. It has a visually hidden label "Coptic text" and the placeholder "Paste or type Coptic text" in the sans font at 18px, ink-60. Minimum height is 200px on phone and 280px on desktop. It grows with its content up to 60% of the viewport height, then scrolls.
- **Bottom bar inside the box**, 68px tall, laid out left to right:
  - the character counter, pushed left
  - the "⌘ Enter" hint (desktop only; show "Ctrl Enter" on non-Apple platforms)
  - a **Clear** ghost button
  - the **Transliterate** primary button: ink background, white text, 8px radius, 44px tall, with a right-arrow icon
- **Appearing:** the hint, Clear, and Transliterate are hidden while the box is empty or only whitespace. When text appears they fade in and rise 6px over 200ms with the DESIGN.md easing, and they reverse when the box is emptied.
- **Counter:** appears only once a paste is over 4,000 characters. It then counts against 16,000 and shows the number of parts, e.g. "9,000 / 16,000 · 3 parts", in mono (see `2026-10-18-long-hymns-design.md` section 6). Over the limit it turns ink with an underline.
- Ctrl/Cmd+Enter submits.
- **Autofocus:** only on devices with a fine pointer, so a phone keyboard doesn't pop up on load (my call).

### Examples

- Heading: "No Coptic on hand? Try one." in 12px mono, ink-60.
- These four, with the Coptic copied exactly from `data/reference.json` (the prototype has the full texts):
  1. Christ is risen
  2. In the name of the Father
  3. The Lord's Prayer
  4. Through the intercessions
- **Desktop:** a vertical stack of cards. Each card has a 1px ink-12 border and a 16px radius. It shows the title, and under it the first line of the Coptic in the Coptic font, ink-60, cut off with an ellipsis. On hover the border turns ink and the card gets `shadow-card`.
- **Phone:** wrapping pill buttons, 44px tall, title only.
- **Known misses:** "The Lord's Prayer" and "Through the intercessions" come from the held-out pairs. The current model still gets a few of their words wrong (*pipethou*, *kha*, *nennobi*), so the live page will show those misses. The user accepted this and wants these examples kept.
- **Pressing one:** it puts the full Coptic in the box and immediately runs a real transliteration through the API. That example then shows as pressed (ink border, white fill, `aria-pressed="true"`) until the box is edited or cleared.

### Output

The output's header, text and choosing now follow `2026-10-18-three-readings-design.md`, section 7. The rest of this section still applies.

A paste over 4,000 characters is walked through part by part, with finished parts folding into rows, as `2026-10-18-long-hymns-design.md`, section 6, describes.

- **Position:** below the input box, 36px gap on phone and 58px on desktop. A 1px ink rule sits on top of a header row: a "Latin" mono label on the left and a **Copy** ghost button on the right.
- **Skeleton, while loading:**
  - Show one bar per line of input. Each bar is as wide as its line, relative to the longest line, with a minimum of 28% width.
  - A blank input line gives a blank row.
  - An input line too long to fit one output row becomes several full-width bars followed by a shorter one. Estimate this from the column width (my call).
  - Show at most 40 rows.
  - Each bar is 0.5em tall, fully rounded, ink at 7% opacity, pulsing to 14% over 1.6s, each row 80ms after the one above.
  - The output region is `aria-busy="true"` and the skeleton is `aria-hidden`. The Copy button is hidden.
- **Long wait (my call):** if loading takes more than 8 seconds, a line appears under the skeleton in ink-60: "Longer passages can take up to a minute."
- **Filling in:** the skeleton is replaced by the Latin, line breaks kept. Each line fades in and rises 4px over 200ms, 40ms after the one before. Cap the total delay at about 500ms so a long passage doesn't crawl in.
- **Scrolling:** after a submit or an example press on phone, smooth-scroll the output into view. On desktop, scroll only if the output starts below the fold.
- **Copy:** copies the Latin with its line breaks, then shows "Copied" for about 1.6s.
- **Stale output:** after a result, editing the box leaves the old output in place until the next submit.

### Requests in flight

- The box stays editable while a request runs.
- Submitting again, or pressing another example, cancels the request in progress with an `AbortController` and starts a new one.
- Clear also cancels it, then empties the box, the output, and any error. If the user is on phone, focus returns to the box.
- **The button while loading (my call):** it reads "Transliterating" with animated dots and is disabled while the box still holds the text that was sent. Once the user edits the box, the button reads "Transliterate" again. Pressing it, or Ctrl/Cmd+Enter, cancels the old request and sends the new text. This lets a phone user fix a typo mid-request without pressing Clear.

### Errors

- **Placement:** inline, directly under the input box. Uses `role="alert"`, ink text, and an outlined alert icon. There is no red (the two-color system).
- **Before sending, run `validateInput` on the client** (my call). `lib/validate.ts` has no server-only imports. This shows empty, too-long, and not-Coptic messages instantly, without spending free-tier quota.
- **Wording:** keep the existing messages from the server and from `app/request-transliteration.ts`.
- **"Try again":** a link after the message for rate-limited, upstream, and network errors. It re-runs the last text. It is not shown for invalid input.
- **Output on error:** hidden; the error replaces it.

### Motion and accessibility

- Use only DESIGN.md's durations and easing.
- With `prefers-reduced-motion`, transitions are near-instant, the skeleton doesn't pulse, lines don't stagger, and scrolling is instant.
- Every interactive element is at least 44×44px and has a visible 2px ink focus outline with a 2px offset.
- The output region is `aria-live="polite"`.
- ink-60 on paper is about 4.8:1, which meets WCAG AA for the 15px+ text it's used on.

## 6. Raising the input limit

The user wants a paste of up to 500 words to work. Today the server rejects anything over 1,000 code points, which is about 150 words.

- **New limit: 4,000 code points (my call).** That is about 500 Coptic words with their combining marks. Change `MAX_INPUT_LENGTH` in `lib/validate.ts` and its tests. The message format stays the same.
- **Output budget.** `maxOutputTokens` in `lib/gemini.ts` is currently `64 + 2 × length`, capped at 2,048. A 4,000-character input would be truncated. Raise or remove the cap so the longest allowed input gets a complete answer, and check whether thinking tokens count against this budget for `gemini-3.5-flash-lite`. Update the `maxOutputTokens` tests.
- **Time.** The route's `maxDuration` is 60 seconds. Before calling this done, run one real request with roughly 4,000 code points of Coptic through the full API, then record its latency and whether the output was complete. If it doesn't fit in 60 seconds, come back to the user. Don't quietly lower the limit.
  - **Measured 2026-10-18:** 3,923 code points (148 lines, 609 words of reference lines in shuffled order) gave a 200 in 4.2 s through `/api/transliterate`, with 148/148 lines and 609/609 words. Gemini reported `finishReason: STOP` and 1,683 output tokens against a budget of 7,910, so the budget needs no change. The same lines repeated as one 31-line block about five times in a row came back short: 86 of 148 lines, `STOP` after 971 tokens. So `gemini-3.5-flash-lite` can end early when a long block repeats verbatim. That is a model behavior, not a budget or time limit.
- **Old spec.** Update `2026-10-17-coptic-transliterator-design.md`:
  - the Input size row
  - section 5's "over 1,000"
  - the `maxOutputTokens` line in section 6
  - the planned 25-second Gemini abort in section 6 (iteration 3). As written, it would time out long passages. Size it to fit inside the 60-second `maxDuration`, around 55 seconds (my call). The 30-second client abort goes with section 8; if the client gets an abort later, give it about 65 seconds so the server answers first.
  - section 8, replaced by a pointer to this document

## 7. Code shape

- **Next.js version.** Per `AGENTS.md`, this Next.js version differs from what you may know. Read the relevant guide in `node_modules/next/dist/docs/` before writing code.
- **Skill.** The user asked for the `design-taste-frontend` skill to be used when building the page.
- **Rewrite** `app/page.tsx` (server component: heading and workspace) and `app/transliterator.tsx` (client component: input box, output, examples, state). Split it further if that reads better.
- **New `app/examples.ts`:** the four examples, each with title and Coptic text.
- **Keep `app/request-transliteration.ts`.** Add an optional `AbortSignal` parameter, and treat an abort as neither a success nor an error shown to the user.
- **`app/layout.tsx`:**
  - Load Hanken Grotesk (400, 500, 700) and JetBrains Mono (400) with `next/font/google`, as CSS variables.
  - Keep the local CS Ava Veni Coptic font. It is an uncommitted change in the working tree, replacing Noto Sans Coptic; commit it with this work. The font's metadata says "All rights reserved" with no license text. The user confirmed they may publish it in this public repo and serve it on the site.
  - Body gets the paper background and ink text.
- **Pure helpers, testable in Vitest's node environment:**
  - the skeleton row widths from input text and an approximate characters-per-row figure
  - counter visibility and over-limit state
  - the line-stagger delays

  There's no DOM test setup today. Adding one is the builder's call.

## 8. Testing and verification

- **Unit tests** (test-first, as in the rest of the repo):
  - the new limit in `lib/validate.ts`
  - `maxOutputTokens`
  - the abort handling in `requestTransliteration`
  - the pure UI helpers
- **In a browser** at 390px and 1280px wide, against the prototype:
  - empty state, then the buttons appearing
  - an example press, through the skeleton, to the result
  - Copy
  - Clear during loading and after a result
  - an over-limit paste
  - a non-Coptic paste
  - a forced server error, with Try again
  - keyboard-only use
  - reduced motion
- **One real long request**, as in section 6.
- **`npm test` and `npm run build`** both pass.

## 9. Calls I made (the user may want to check these)

- The heading and subline copy.
- Tints of ink (60%, 12%, 6%) for secondary text, hairlines and hovers.
- 12px only for labels; larger reading sizes for input and output.
- Examples run immediately rather than only filling the box.
- The skeleton follows the input's line shape.
- The 8-second "up to a minute" line.
- The 4,000 code point limit.
- Validating on the client before sending.
- The button re-enables mid-request once the text is edited, and resubmitting cancels the old request.
- Planned timeouts resized to fit the 60-second function limit.
- Autofocus only with a fine pointer.
- Stale output stays until the next submit.
- "Try again" only for retryable errors.

## 10. Left to the builder

- Component structure, file split, and state shape.
- How the textarea auto-grows where `field-sizing: content` isn't supported.
- Icon drawing (simple 1.5px-stroke line icons, as in the prototype).
- Favicon.
- How the skeleton estimates characters per row.
