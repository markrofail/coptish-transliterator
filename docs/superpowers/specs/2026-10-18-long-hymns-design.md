# Long Hymns, Bite by Bite — Design

Date: 2026-10-18
Status: Implemented (approved by the user on 2026-10-18)

This document builds on `2026-10-18-three-readings-design.md` and `2026-10-18-page-redesign-design.md`. It changes the page's input limit and adds a walk-through for long pastes. The server, the API contract, the prompt, the model and the three readings are unchanged.

## 1. Intent

People try to transliterate a whole long hymn in one go. The page stops them at 4,000 characters. The example the user gave, *The Commemoration of Saints* (tasbeha.org hymn 1286), is 9,000 characters: 81 stanzas, 324 lines and about 1,255 words.

The user wants a long paste split into length-compliant parts, then taken **bite by bite**:

1. The page transliterates part 1, and the reader settles its disagreements.
2. Then the reader moves on to the next part.

The reason is the progression itself: one digestible piece at a time. Carrying choices from one part into the next is not the goal.

## 2. Goals, non-goals, anti-goals

**Goals**

- A paste of up to 16,000 characters works. Over 4,000, it's split into parts automatically.
- The reader works through the parts one at a time. Finished parts fold away but stay available.
- At the end, the whole hymn reads and copies as one text, with the reader's choices in it.
- A paste of 4,000 characters or fewer works exactly as today.

**Non-goals**

- AI splitting. The user agreed to a rule-based split.
- Carrying a choice from one part into later ones. The user said "just bite by bite progression".
- Fetching the next part ahead of time (my call, section 6).
- Changing the server's 4,000 per-request limit, the API, the prompt or the model.
- Storing a walk-through, or resuming it after a reload. The app stays stateless.

**Anti-goals** (my reading of what would make this a failure even if it works)

- A cut inside a word, or a part that changes, drops or repeats any text.
- The reader losing their choices in a part by folding it, or by moving on.
- A long paste that spends quota on parts the reader never asks for.
- A short paste that looks or behaves any differently from today.

## 3. Decided by the user

| Topic | Decision |
|---|---|
| Problem | People paste a whole long hymn and hit the character limit. |
| Text shape | There's no guarantee of line or stanza breaks. |
| Splitting | A rule, not AI. It cuts at safe boundaries and never inside a word. |
| Flow | Bite by bite: do one part, settle its differences, move on to the next. |
| Why | The progression itself. Carrying choices forward is not the point. |
| Layout | Option C, "finished parts fold up", as in the approved mockup `docs/superpowers/specs/2026-10-18-long-hymns-states.html`. Its six states are a long paste, part 1 running, next part with nothing chosen, reopening a part, a part failing, and all done. |

The user also approved the behaviour as played back: optional settling, live folded parts, per-part retry, "Show the whole hymn", Copy all, and Clear discarding the walk-through. Section 6 writes it out. Where the mockup and this document disagree, this document wins.

## 4. Limits

- **Per request:** 4,000 code points, unchanged. That's `MAX_INPUT_LENGTH` in `lib/validate.ts`, and the server keeps enforcing it.
- **Per paste, on the page: 16,000 code points** (my call). That's about 2,000 words, or four parts. The user's example fits with room to spare.
- **Counting:** both limits count code points after trimming, as `validateInput` does today.
- **Over 16,000:** the existing message format, with the new number and no thousands separator, as today: "That's 16001 characters. The limit is 16000, so try a shorter passage."
- **The Coptic check** ("This doesn't look like Unicode Coptic…") runs once, on the whole paste, before anything is sent.

## 5. Splitting (`lib/split-parts.ts`, pure)

Input: the validated, trimmed paste. Output: an ordered list of parts. Each part has its text and the separator that was removed before it. The separator is `"\n\n"`, `"\n"` or `" "`, or `""` for the first part.

- **No split needed:** 4,000 code points or fewer gives one part, the whole text.
- **Balanced parts (my call):** aim for `n = ceil(length / 4000)` parts of roughly equal length. Then the user's 9,000-character example becomes three parts of about 3,000, not 4,000 + 4,000 + 1,000. No part may exceed 4,000 code points. If the boundaries force an extra part, allow it.
- **Where to cut,** near each target point, in order of preference:
  1. a blank line (a stanza break)
  2. a line break
  3. a space right after `:`, `.` or `·`
  4. any space

  Within the best type available near the target, take the cut closest to the target. A cut is never inside a word.
- **A text with no spaces at all near a cut,** which is unrealistic, is cut at the 4,000 limit. Unit-test it so it can't loop or lose text.
- **Each part is trimmed.** The removed whitespace is recorded as the separator: a blank line is `"\n\n"`, a single line break is `"\n"`, and any other whitespace is `" "`.
- **The invariant,** tested on several inputs: joining the parts with their separators gives back the trimmed paste, apart from whitespace collapsed at the cuts.

The exact search, meaning how far from the target to look and the window sizes, is the builder's call within these rules.

## 6. The page (changes the Input box and Output sections of the redesign spec, and section 7 of the three-readings spec)

### Short pastes

At 4,000 characters or fewer, everything is exactly as today: no parts, no new labels.

### The input box

- **Counter (my call).** It appears once the paste is over 4,000 characters, and shows "9,000 / 16,000 · 3 parts" in mono. It no longer appears at 3,200, because 4,000 is no longer a limit for the paste. The number of parts comes from the same split function. Over 16,000 it shows the existing over-limit style.
- **Primary button.** For a paste over 4,000, it reads "Transliterate part 1" (my call). Otherwise it reads "Transliterate", as today. While loading it reads "Transliterating", as today.

### The walk-through

- **Pressing the button** splits the paste and starts part 1. **Only the current part is fetched**, using today's three readings. A part is fetched only when the reader asks for it (my call: no prefetch). A reader who stops after part 1 has spent 3 requests, not 9, and the requests spread over minutes instead of arriving together.
- **A part is done** as soon as its readings are back, whether it's open or folded (my call).
- **The output header** keeps the ink rule and the "Latin" label.
  - **Copy all** appears on the right once any part is done. It copies every done part in order, including the one on screen, with the reader's choices, joined by the parts' separators. Copying part 1 on its own never requires fetching part 2.
  - **When every part is done,** the label reads "Latin · whole hymn", even before Finish is pressed.
- **The current part** sits under a hairline row labelled "Part 2 of 3", in mono.
  - **While running:** today's dots and "n of 3 back" on the right of that row, and today's skeleton below, sized to the part.
  - **When back:** today's merged text with its marks, chooser and note, then a primary **Next part →** button.
  - **Settling marks is optional.** Next part is always enabled. Unsettled marks keep their default, which is what most readings said.
- **Pressing Next part** folds the current part, starts the next one, and scrolls it into view. Today's scroll rule applies: always on a phone, and on desktop only when it's below the fold.
- **On the last part,** the button reads **Finish** (my call). Pressing it folds the last part and shows the all-done state:
  - every part folded
  - the note "All N parts done"
  - a **Show the whole hymn** button that unfolds every part in full (my call). The rows stay, each with Hide, and the button then reads **Fold all**.
- **A folded part** is one 48px row: "Part 1 · 27 stanzas · 2 of 3 chosen", with a **Show** link.
  - **Show** unfolds the whole part in place, live: its marks can still be changed, and the choices survive any number of folds. The link then reads **Hide**. The mockup's "… 26 more stanzas" only stands for the rest of the part.
  - **The size count (my call)** is in stanzas when the part has blank lines, otherwise lines, or words for a one-line part.
  - **The choice summary:**
    - "k of N chosen" when the part has N marks
    - "all agree" when it has none and all 3 readings merged
    - "2 of 3 readings came back" when it has none and fewer merged
- **A part comes back incomplete** when no reading has the part's line count, so they were all left out of the merge. Flash-lite has been seen to stop early on repetitive text, and hymn refrains repeat. The part then shows the fallback reading, as today, plus the note "Some lines may be missing from this part" and **Try again** for that part. Its folded row adds "· lines may be missing". Missing stanzas never go unremarked (my call).
- **A part fails** when all three of its readings fail. Today's error message appears under that part's row, in today's alert style, with **Try again** for just that part. Earlier parts are untouched. A non-retryable error, such as a part the server rejects as not Coptic, shows the message with no Try again. The walk-through can't continue past it, and that's accepted as rare (my call).
- **During a walk-through:**
  - **Editing the box** doesn't affect it. Its parts were fixed when it started.
  - **Pressing Transliterate again** starts a new walk-through and discards the old one, as resubmitting does today.
  - **Clear** discards everything, as today.
  - **An example press** starts a new run, as today.
- **Long wait:** today's 8-second "Longer passages can take up to a minute" line appears per part.

### Leaving the feedback door open

`recordChoice` (three-readings spec, section 8) also receives the part number, so a stored choice can later be traced to its place in the hymn.

## 7. Testing and verification

- **Unit tests,** test-first:
  - The split:
    - a short paste gives one part
    - balanced parts, each at most 4,000
    - cut preference: blank line, then line break, then punctuation space, then any space
    - never a cut inside a word
    - a text with no line breaks at all
    - the 16,000 maximum
    - the no-spaces fallback
    - the join invariant
  - The new limit and its message.
  - The counter's label and part count.
  - The folded-row text: the size counts and the choice summary.
  - The Copy all join.
  - Keep each of these pure, so it can be tested in Vitest's node environment.
- **In headless Chrome** (Playwright with the installed Chrome, as before), with stubbed API responses:
  - a short paste unchanged
  - a long paste's counter and button
  - part 1, then Next part with nothing chosen
  - Show and Hide, with choices surviving
  - a failed part, then Try again
  - Finish and Show the whole hymn
  - Copy all
  - Clear mid-walk
  - pressing Transliterate again mid-walk
  - a late reply from a discarded walk-through never landing
  - keyboard use
  - reduced motion
- **One real run** with the user's example hymn (tasbeha.org 1286, about 9,000 characters): all three parts through the live pipeline, 9 requests in total. Record the parts' sizes, each part's time, and each reading's line count against its part's.
  - Measured 2026-10-18: the hymn is 9,000 characters, 81 stanzas and 324 lines, in 3 parts of 3,012, 2,999 and 2,985 characters (134 lines each, blank separators included). Parts took about 7.6 s, 5.6 s and 6.0 s from press to text, with single readings taking 3.6 to 4.2 s. Every reading I recorded came back with its part's 134 lines (parts 2 and 3 in full; part 1's third reading), no part was incomplete, and Copy all gave 81 stanzas.
  - **Stop rule (my call):** if any part comes back incomplete, stop and bring the numbers to the user, rather than tuning part sizes without them.
- **`npm test` and `npm run build`** both pass.

## 8. Calls I made (the user may want to check these)

- A paste limit of 16,000 characters. The server's limit stays at 4,000.
- Balanced parts rather than filling each part to 4,000.
- Cut preference: blank line, then line break, then a space after `:`, `.` or `·`, then any space.
- No prefetching: a part is fetched only when the reader asks for it.
- The counter shows the number of parts, and the button reads "Transliterate part 1".
- The last part's button reads "Finish", which leads to the all-done state.
- The folded row counts stanzas, lines or words, and summarises choices the way the notes do.
- A non-retryable part error stops the walk-through. Accepted as rare.
- `recordChoice` gains the part number.
- A part counts as done once its readings are back. Copy all includes the part on screen.
- An incomplete part is flagged, with Try again, never shown silently.
- Show opens a whole part. Show the whole hymn unfolds every part, then reads Fold all.
- The counter appears from 4,000, not 3,200.
- The real run's stop rule for incomplete parts.

## 9. Left to the builder

- The exact search near each target cut, within section 5's rules.
- Where parts' state lives, and how choices survive folding: lifted state, or mounted-but-hidden parts.
- Component structure and file split.
- Spacing and motion of folding and unfolding, within DESIGN.md's tokens.
- How the browser checks stub and force failures.
