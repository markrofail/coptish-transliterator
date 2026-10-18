# Three Readings — Design

Date: 2026-10-18
Status: Approved by the user on 2026-10-18

This document changes the API contract (section 4) and the model call (section 6) of `2026-10-17-coptic-transliterator-design.md`, and the Output section of `2026-10-18-page-redesign-design.md`. Everything else in those two documents stands.

## 1. Intent

Today one Gemini call produces one transliteration. When the model is unsure, for example ⲱⲟⲩ as *oou* or *ou*, or ⲃ as *v* or *b*, the reader never finds out. They get one spelling and assume it's right.

The people using the page are churchgoers who have heard these prayers said aloud. They don't need to know the spelling rules, because they can recognize which version sounds like what they hear in church. The user wants every transliteration to make **three Gemini calls**, and the page to let the reader **choose the most authentic, faithful-sounding result**.

The approved design (option C) shows one text. The words all three readings agree on are plain. Each place where they disagree is marked, and the reader taps it to choose between the versions.

Later, the user wants a feedback loop: the readers' choices get stored, and a nightly job analyses them. Storage and that job are **out of scope now**, but this design keeps the door open for them (section 8).

## 2. Goals, non-goals, anti-goals

**Goals**

- Every transliteration runs three readings at the same time.
- The page shows visibly that three requests started, and when each one comes back.
- One merged text, with the disagreements marked and choosable word by word.
- Copy gives the text with the reader's choices.
- The wait stays about what it is today.

**Non-goals**

- Storing choices, sending them anywhere, or analysing them (later, per the user).
- Showing the three full readings side by side, or choosing a whole reading (options A and B, which the user did not pick).
- Changing the prompt, the reference set, the model, or the jinkim pre-pass.
- Accounts, history and shareable links (unchanged from the earlier specs).

**Anti-goals** (my reading of what would make this a failure even if it works)

- Three readings that are always identical, so there is never anything to choose.
- So many marks that the text becomes hard to read aloud. Marks should mostly sit where the model is genuinely unsure.
- A merged default text that is worse than today's single reading.
- Storing or logging what people type. The app stays stateless, and logs never contain text.

## 3. Decided by the user

| Topic | Decision |
|---|---|
| Calls | Three Gemini calls for every transliteration. |
| Who chooses, and how | A churchgoer picks the version that sounds most authentic and faithful. |
| Loading | Show visibly that three requests started. |
| Layout | Option C: one text, choose where they disagree. |
| States | As in the approved mockup, `docs/superpowers/specs/2026-10-18-three-readings-states.html`: waiting, back, choosing, chosen, all agree, one request failed. |
| Feedback loop | Wanted later (storage plus a nightly job that analyses choices). Out of scope now, with the door left open. |

Open the mockup in a browser. It's a static drawing of the six states at phone width, not code to port. Where it and this document disagree, this document wins.

## 4. How the three readings differ

**My call.** At temperature 0, three identical calls return nearly identical text, so the readings need different settings.

- **Reading 1** uses today's settings exactly: `gemini-3.5-flash-lite`, low thinking, temperature 0. It's the anchor. With no disagreement, the page shows exactly what it shows today.
- **Readings 2 and 3** use the same model, prompt and thinking level, at **temperature 1.0**, Gemini's default. They differ from each other only by sampling.
- **Tune the temperature with the evaluation** (section 9). If the marks mostly fall on words reading 1 already got right, lower it. If the readings almost never disagree, raise it. Keep 2 and 3 at the same temperature.

The settings live on the server in one table, indexed by reading number. The browser only sends the number.

## 5. Server

### API (changes section 4 of the first spec)

`POST /api/transliterate`, with request body `{ "text": string, "reading"?: 1 | 2 | 3 }`.

- A missing `reading` means 1, so pages loaded before the deploy keep working.
- Any other value is `400 invalid_input` with the message "reading must be 1, 2 or 3."
- Success and error responses are unchanged: `200 { "latin": string }`, and the existing error codes and messages.

### Model call (changes section 6 of the first spec)

- `GeminiConfig` gains `temperature`. `lib/gemini.ts` exports the three reading configs. `DEFAULT_CONFIG` stays reading 1, so `npm run eval` and the existing tests keep their meaning.
- The `transliterate` log line gains the reading number and temperature. It still never contains input or output text.
- `maxOutputTokens`, the jinkim pre-pass, the prompt and the validation are unchanged.

### Cost

Every transliteration uses three free-tier requests instead of one, so the site serves about a third as many transliterations a day. The three requests arrive together, so a per-minute limit fills three times as fast. When some requests in a set are rate-limited, the page shows the readings that came back (section 7).

## 6. Merging (`lib/merge-readings.ts`, pure)

Inputs: the readings that came back, keyed by reading number, plus the line count of the validated input text.

- **Lines.** Split each reading on line breaks. A reading whose line count differs from the input's is left out of the merge (my call). Treat it like a failed request in the UI. If that leaves no reading, show the lowest-numbered reading that came back as plain text, with no marks.
- **Words.** Within each line, split on whitespace and align the readings word by word with a standard sequence diff. A maximal run where they don't all agree becomes one **span**. A span can cover several words, for example *enneet e* against *enneeete*.
- **Neighbouring disagreements (my call).** When every reading has the same number of words in such a run, split it into one span per word position instead, and leave any position they agree on as a plain word. This matches the mockup, where *evolha* and *pipethoou:* are marked and chosen separately.
- **What counts as a disagreement (my call).** Compare words ignoring letter case and punctuation, so *Ethouab* against *ethouab*, or *pipethoou:* against *pipethoou*, is not marked. Where words agree, show the default reading's form.
- **Alternatives.** Each span lists each reading's text for that run, which may be empty when a reading left a word out. Alternatives that are the same under the comparison above are combined into one (my call), shown in the form of the lowest-numbered reading that gave it, recording which readings gave it.
- **Default.** The alternative given by the most readings. On a tie, use reading 1's alternative if reading 1 is present, otherwise the lowest-numbered reading's.
- **Output shape.** For each line: a sequence of plain text and spans. Each span has its alternatives (text plus reading numbers), the default, and the current choice. Also return how many readings were merged.

Unit-test this module thoroughly. It is where most of the subtle behavior lives.

## 7. The page (changes the Output section of the redesign spec)

### Requests

- Submitting, or pressing an example, sends three `POST /api/transliterate` requests at once, with `reading` 1, 2 and 3 (my call: the browser sends them, so each dot reflects a real request).
- They share one `AbortController`. Submitting again, pressing another example, or Clear cancels all three, as today.
- **Waiting for stragglers (my call).** The text appears when all three are back. If two are back, at least one of them with a reading, and the third is still running 10 seconds after the first reading arrived, stop waiting: count it as failed, ignore its reply if it arrives later, and show what's back. This keeps one slow request from holding up the rest. (Its Gemini call is already paid for, so aborting it would save nothing.)
- **All three fail:** show today's error UI and Try again. Use the rate-limited message if any request was rate-limited, otherwise the existing generic message.

### Header and dots

- The header row is as today: a 1px ink rule and the "Latin" mono label.
- **While waiting:** on the right, three 8px dots with a 1.5px ink border. They blink while their request runs and fill solid ink when it comes back. Next to them, "1 of 3 back" in 12px mono, ink-60. The skeleton below is today's skeleton, unchanged.
- **When all three came back:** the dots give way to Copy, as today.
- **When any failed or was left out:** the dots stay beside Copy. A failed dot is hollow and dashed at 45% opacity.
- Screen readers get the count as text. The dots themselves are decorative.

### Text, marks and notes

- The merged text replaces the skeleton, with today's line rise and stagger.
- **A marked span** shows its current choice with an ink tint at 7%, a 4px radius and a 2px ink underline. **While its chooser is open**, it's solid ink with paper text. **Once the reader has chosen**, it keeps only the underline, so they can find it and change it.
- **A span whose default is empty** shows as a small marked gap that opens the same chooser. How to draw it is the builder's call.
- **A note under the text**, in 14–15px ink-60:
  - "2 words where the readings disagree · tap one to choose". Count spans, and say "1 word … · tap it to choose" for one.
  - after choosing: "1 of 2 chosen"
  - when nothing disagrees: "All 3 readings agree"
  - when fewer than three were merged, put this first: "2 of 3 readings came back · …". When those two agree, the rest is "they agree".
  - when only one was merged, say just that, with no marks

### The chooser

- Every marked span is a button, and tapping it opens the chooser **directly under that line**, pushing the lines below it down, as in mockup frame 3. Only one chooser is open at a time.
- **A line means a line of the text, not a screen row (my call).** When a long line wraps on a phone, the chooser opens below the whole line, and the solid-ink span shows which word it belongs to. No layout measuring.
- **Contents:** a "Choose a reading" label, then one 44px row per alternative, most common first, each with its count in mono ("2 of 3"). The current choice is solid ink. An empty alternative reads "(leave out)".
- **Picking** a row updates the text and closes the chooser, and focus returns to the span.
- **Closing without a pick:** Escape, tapping the span again, or tapping outside.
- **Accessibility:** the span has `aria-expanded`. The rows are a listbox (my call): arrow keys move between rows, and Enter or Space picks one. All of it gets the existing focus outline and 44px targets. A marked span keeps the text's line height, so its 44px tap target extends invisibly above and below it.

### Copy

Copy copies the text as currently shown, with the reader's choices and every line break.

## 8. Leaving the door open for the feedback loop

- Every pick goes through **one function** in the client, for example `recordChoice`. It receives the line number, the span's alternatives with their reading numbers, the default, and the chosen alternative. Today it only updates state. Later, sending the choice to storage gets added there and nowhere else.
- Each alternative keeps the reading numbers that produced it, and the server's reading table says what settings each number used. So a stored choice can later be tied back to its settings.
- Nothing is stored, sent or logged today.

## 9. Evaluation

Extend `npm run eval` with a three-readings mode that does what the app does for each held-out pair: run readings 1–3, then merge. Report:

- reading 1's score, as today
- the **default merged text's** score, which should be no worse than reading 1's
- the average number of spans per line
- of those spans, how many sit where reading 1 is wrong (useful) and how many where it's right (noise)
- how often the gold spelling is reachable by choosing

Use these numbers to set the temperature for readings 2 and 3 (section 4), and record the runs and the chosen value in the first spec's iteration table.

**Stop rule (my call).** A temperature passes when, in the same run:

- the default merged text's mean character accuracy is at most 0.5 points below reading 1's
- there's at most 1.0 span per line on average
- useful spans are at least as many as noise spans, and at least one span is useful

Try 1.0 first, then 0.7, then 0.4, and stop at the first that passes. That's at most three runs, 144 requests. If none passes, or the free quota runs out, stop and bring the numbers to the user. Don't ship a guessed temperature.

One run costs 48 requests (16 held-out pairs × 3). Keep the existing delay between calls.

## 10. Testing and verification

- **Unit tests,** test-first as in the rest of the repo:
  - `merge-readings`: all agree; one-word span; multi-word span; empty alternative; case- and punctuation-only differences not marked; line-count mismatch left out; two readings; one reading; tie-breaking.
  - the route's `reading` handling, including a missing and an invalid value
  - the reading configs and the temperature passed to Gemini
  - `requestTransliteration` sending `reading`
  - the logic that combines the three results into what the page shows (successes, failures, straggler cut-off, all failed). Keep it pure so it's testable in node.
- **In a browser** at 390px and 1280px, against the mockup:
  - the waiting dots
  - a result with marks, then choosing and changing a choice
  - Copy after choosing
  - all agree
  - one request failing (force it)
  - all failing, then Try again
  - Clear during loading
  - keyboard-only use of the chooser
  - reduced motion
- **One real run** on the live API with an example that has known disagreements, such as the Lord's Prayer.
- **`npm test` and `npm run build`** both pass.

## 11. Calls I made (the user may want to check these)

- Reading 1 stays exactly today's settings. Readings 2 and 3 run at temperature 1.0, to be tuned with the evaluation.
- The browser sends three requests, rather than one request that fans out on the server.
- The text waits for all three, with a 10-second cut-off after the first returns. A straggler is ignored, not aborted.
- Case- and punctuation-only differences aren't marked.
- Default choice: the majority, and on a tie, reading 1.
- Alternatives that differ only in case or punctuation are combined.
- Neighbouring disagreements of equal length are split into one span per word.
- The chooser is a listbox, not a radio group.
- A reading with the wrong number of lines is left out.
- A missing `reading` means 1, and an invalid one is a 400.
- The notes' wording, and the "(leave out)" row.
- On a wrapped line, the chooser opens below the whole line.
- The temperature stop rule (section 9).

## 12. Left to the builder

- The diff algorithm, as long as it gives the spans section 6 describes.
- Component structure, file split and state shape.
- How the empty-default gap is drawn, and the chooser's exact spacing within DESIGN.md.
- How the evaluation's "useful", "noise" and "reachable" counts are computed.
- How to force a failed request during the browser checks.
