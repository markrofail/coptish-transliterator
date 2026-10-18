import type { ClientResult } from "@/app/request-transliteration";
import { GENERIC_ERROR_MESSAGE, RATE_LIMITED_MESSAGE } from "@/app/request-transliteration";
import { mergeReadings, type Merged } from "@/lib/merge-readings";
import { READING_NUMBERS, type Reading } from "@/lib/readings";

/** How long to wait for the last reading, counted from when the first successful one came back. */
export const STRAGGLER_MS = 10000;

export type ReadingStatus = "waiting" | "back" | "failed";
export type Statuses = Record<Reading, ReadingStatus>;
export type Results = Partial<Record<Reading, ClientResult>>;
export type Settled =
  | { kind: "waiting"; statuses: Statuses }
  | { kind: "done"; statuses: Statuses; merged: Merged }
  | { kind: "error"; message: string; retryable: boolean };

export function settleReadings(
  results: Results,
  inputLineCount: number,
  stopWaiting: boolean,
): Settled {
  const statuses = {} as Statuses;
  const texts: Partial<Record<Reading, string>> = {};
  for (const reading of READING_NUMBERS) {
    const result = results[reading];
    if (!result) statuses[reading] = stopWaiting ? "failed" : "waiting";
    else if (result.ok) {
      statuses[reading] = "back";
      texts[reading] = result.latin;
    } else statuses[reading] = "failed";
  }

  if (READING_NUMBERS.some((reading) => statuses[reading] === "waiting")) {
    return { kind: "waiting", statuses };
  }

  if (Object.keys(texts).length === 0) {
    const failures = READING_NUMBERS.flatMap((reading) => {
      const result = results[reading];
      return result && !result.ok && !result.aborted ? [result] : [];
    });
    const limited = failures.find((failure) => failure.message === RATE_LIMITED_MESSAGE);
    const chosen = limited ?? failures[0];
    return chosen
      ? { kind: "error", message: chosen.message, retryable: chosen.retryable }
      : { kind: "error", message: GENERIC_ERROR_MESSAGE, retryable: true };
  }

  const merged = mergeReadings(texts, inputLineCount);
  for (const reading of READING_NUMBERS) {
    if (statuses[reading] === "back" && !merged.readings.includes(reading)) {
      statuses[reading] = "failed";
    }
  }
  return { kind: "done", statuses, merged };
}

/**
 * Milliseconds until the last reading is given up on, or null when no deadline applies. The
 * countdown runs only while exactly one reading is pending and at least one came back ok, so a
 * slow request can't hold up readings already in hand. With only failures back, there is nothing
 * in hand, so the page keeps waiting. `firstBackAt` is when the first ok reading came back.
 */
export function stragglerDelay(
  results: Results,
  firstBackAt: number | null,
  now: number,
): number | null {
  const back = Object.values(results);
  if (firstBackAt === null || back.length !== 2 || !back.some((result) => result?.ok)) return null;
  return Math.max(0, firstBackAt + STRAGGLER_MS - now);
}
