import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_ERROR_MESSAGE } from "@/app/request-transliteration";
import { runReadings } from "@/app/run-readings";
import { STRAGGLER_MS, type Settled } from "@/app/settle-readings";
import type { Reading } from "@/lib/readings";

const TEXT = "Ⲁⲙⲏⲛ";

/** A fake fetch that holds every request until the test replies to it, in any order. */
function fakeFetch() {
  const pending = new Map<number, (response: Response) => void>();
  const fetchImpl = vi.fn<typeof fetch>(
    (_url, init) =>
      new Promise<Response>((resolve) => {
        pending.set(JSON.parse(String(init?.body)).reading, resolve);
      }),
  );
  async function reply(reading: Reading, response: Response) {
    pending.get(reading)?.(response);
    // Lets the reply work its way through requestTransliteration and the run.
    await vi.advanceTimersByTimeAsync(0);
  }
  return { fetchImpl, reply };
}

function start() {
  const { fetchImpl, reply } = fakeFetch();
  const onUpdate = vi.fn<(settled: Settled) => void>();
  const stop = runReadings(TEXT, onUpdate, fetchImpl);
  const kinds = () => onUpdate.mock.calls.map(([settled]) => settled.kind);
  const last = () => onUpdate.mock.lastCall?.[0];
  return { fetchImpl, reply, onUpdate, stop, kinds, last };
}

const latin = () => Response.json({ latin: "a" });
const upstream = () =>
  Response.json({ error: { code: "upstream", message: "unavailable" } }, { status: 502 });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("runReadings", () => {
  it("sends the text once per reading", () => {
    const { fetchImpl, stop } = start();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "/api/transliterate",
      "/api/transliterate",
      "/api/transliterate",
    ]);
    expect(fetchImpl.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { text: TEXT, reading: 1 },
      { text: TEXT, reading: 2 },
      { text: TEXT, reading: 3 },
    ]);
    stop();
  });

  it("reports waiting, then done", async () => {
    const { reply, kinds, last } = start();
    await reply(1, latin());
    await reply(2, latin());
    await reply(3, latin());
    expect(kinds()).toEqual(["waiting", "waiting", "done"]);
    expect(last()).toMatchObject({ kind: "done", statuses: { 1: "back", 2: "back", 3: "back" } });
    await vi.runAllTimersAsync();
    expect(kinds()).toEqual(["waiting", "waiting", "done"]);
  });

  it("cuts off a straggler", async () => {
    const { reply, onUpdate, kinds, last } = start();
    await reply(1, latin());
    await reply(2, latin());
    expect(kinds()).toEqual(["waiting", "waiting"]);
    await vi.advanceTimersByTimeAsync(STRAGGLER_MS);
    expect(last()).toMatchObject({ kind: "done", statuses: { 1: "back", 2: "back", 3: "failed" } });
    const calls = onUpdate.mock.calls.length;
    await reply(3, latin());
    await vi.runAllTimersAsync();
    expect(onUpdate).toHaveBeenCalledTimes(calls);
  });

  // Review Focus 1
  it("stop drops every later reply", async () => {
    const { fetchImpl, reply, onUpdate, stop } = start();
    await reply(1, latin());
    stop();
    await reply(2, latin());
    await reply(3, latin());
    await vi.runAllTimersAsync();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      kind: "waiting",
      statuses: { 1: "back", 2: "waiting", 3: "waiting" },
    });
    expect(fetchImpl.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
  });

  // Review Focus 1, without the abort: a reply already past it, and the armed cut-off, are dropped too.
  it("stop drops later replies and the cut-off even when the abort comes too late", async () => {
    vi.spyOn(AbortController.prototype, "abort").mockImplementation(() => {});
    const { reply, onUpdate, stop } = start();
    await reply(1, latin());
    await reply(2, latin());
    stop();
    await reply(3, latin());
    await vi.advanceTimersByTimeAsync(STRAGGLER_MS);
    await vi.runAllTimersAsync();
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it("reports an error when all fail", async () => {
    const { reply, kinds, last } = start();
    await reply(1, upstream());
    await reply(2, upstream());
    await reply(3, upstream());
    expect(kinds()).toEqual(["waiting", "waiting", "error"]);
    expect(last()).toEqual({ kind: "error", message: GENERIC_ERROR_MESSAGE, retryable: true });
  });
});
