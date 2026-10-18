import { describe, expect, it } from "vitest";
import { GENERIC_ERROR_MESSAGE, RATE_LIMITED_MESSAGE } from "@/app/request-transliteration";
import { settleReadings, stragglerDelay } from "@/app/settle-readings";
import { mergeReadings } from "@/lib/merge-readings";

const ok = (latin: string) => ({ ok: true as const, latin });
const fail = (message = GENERIC_ERROR_MESSAGE, retryable = true) => ({
  ok: false as const,
  aborted: false as const,
  message,
  retryable,
});

describe("settleReadings", () => {
  it("waits while any reading is running", () => {
    expect(settleReadings({ 1: ok("a") }, 1, false)).toEqual({
      kind: "waiting",
      statuses: { 1: "back", 2: "waiting", 3: "waiting" },
    });
  });

  it("shows a failure while still waiting", () => {
    expect(settleReadings({ 1: fail(), 2: ok("a") }, 1, false)).toEqual({
      kind: "waiting",
      statuses: { 1: "failed", 2: "back", 3: "waiting" },
    });
  });

  it("merges when all three are back", () => {
    expect(settleReadings({ 1: ok("a"), 2: ok("a"), 3: ok("b") }, 1, false)).toEqual({
      kind: "done",
      statuses: { 1: "back", 2: "back", 3: "back" },
      merged: mergeReadings({ 1: "a", 2: "a", 3: "b" }, 1),
    });
  });

  it("merges what came back when one failed", () => {
    const settled = settleReadings(
      { 1: ok("a"), 2: fail(RATE_LIMITED_MESSAGE), 3: ok("b") },
      1,
      false,
    );
    expect(settled).toMatchObject({
      kind: "done",
      statuses: { 1: "back", 2: "failed", 3: "back" },
    });
    expect(settled.kind === "done" && settled.merged.readings).toEqual([1, 3]);
  });

  it("counts a straggler as failed once it stops waiting", () => {
    const settled = settleReadings({ 1: ok("a"), 2: ok("a") }, 1, true);
    expect(settled.kind).toBe("done");
    expect(settled.kind === "done" && settled.statuses[3]).toBe("failed");
  });

  it("marks a reading left out of the merge as failed", () => {
    const settled = settleReadings({ 1: ok("a\nb"), 2: ok("a b"), 3: ok("a\nb") }, 2, false);
    expect(settled.kind).toBe("done");
    if (settled.kind !== "done") return;
    expect(settled.statuses[2]).toBe("failed");
    expect(settled.merged.readings).toEqual([1, 3]);
  });

  it("shows reading 1 alone when readings 2 and 3 were rate-limited", () => {
    const settled = settleReadings(
      { 1: ok("Amen"), 2: fail(RATE_LIMITED_MESSAGE), 3: fail(RATE_LIMITED_MESSAGE) },
      1,
      false,
    );
    expect(settled).toMatchObject({
      kind: "done",
      statuses: { 1: "back", 2: "failed", 3: "failed" },
    });
    expect(settled.kind === "done" && settled.merged.readings).toEqual([1]);
  });

  it("uses the rate-limit message when all failed and one was rate-limited", () => {
    expect(
      settleReadings({ 1: fail(), 2: fail(RATE_LIMITED_MESSAGE), 3: fail() }, 1, false),
    ).toEqual({ kind: "error", message: RATE_LIMITED_MESSAGE, retryable: true });
  });

  it("otherwise uses the lowest reading's failure", () => {
    const f = () => fail("Enter some Coptic text to transliterate.", false);
    expect(settleReadings({ 1: f(), 2: f(), 3: f() }, 1, false)).toEqual({
      kind: "error",
      message: "Enter some Coptic text to transliterate.",
      retryable: false,
    });
  });

  it("treats aborted results as failed", () => {
    const aborted = { ok: false as const, aborted: true as const };
    expect(settleReadings({ 1: aborted, 2: aborted, 3: aborted }, 1, false)).toEqual({
      kind: "error",
      message: GENERIC_ERROR_MESSAGE,
      retryable: true,
    });
  });
});

describe("stragglerDelay", () => {
  it("waits without a deadline while two are running", () => {
    expect(stragglerDelay({ 1: ok("a") }, 1000, 1500)).toBeNull();
  });

  it("counts down once only one is running", () => {
    expect(stragglerDelay({ 1: ok("a"), 2: fail() }, 1000, 4000)).toBe(7000);
  });

  it("is due at once when overdue", () => {
    expect(stragglerDelay({ 1: ok("a"), 2: ok("a") }, 1000, 12000)).toBe(0);
  });

  it("waits without a deadline when only failures are back", () => {
    expect(stragglerDelay({ 2: fail(), 3: fail() }, 1000, 20000)).toBeNull();
  });

  it("has no deadline before anything is back or after all are", () => {
    expect(stragglerDelay({}, null, 0)).toBeNull();
    expect(stragglerDelay({ 1: ok("a"), 2: ok("a"), 3: ok("a") }, 1000, 2000)).toBeNull();
  });
});
