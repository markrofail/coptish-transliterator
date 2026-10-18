import { requestTransliteration } from "@/app/request-transliteration";
import {
  settleReadings,
  stragglerDelay,
  type Results,
  type Settled,
} from "@/app/settle-readings";
import { READING_NUMBERS } from "@/lib/readings";

// One run: the three readings of one text, sharing one controller.
type Run = {
  controller: AbortController;
  results: Results;
  firstBackAt: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  settled: boolean;
  stopped: boolean;
};

/**
 * Sends `text` once per reading and reports each step to `onUpdate`: `waiting` as replies come in,
 * then one `done` or `error`, and nothing after that. Returns `stop()`, which cancels the run, so
 * none of its replies or its timer can call `onUpdate` again.
 */
export function runReadings(
  text: string,
  onUpdate: (settled: Settled) => void,
  fetchImpl?: typeof fetch,
): () => void {
  const run: Run = {
    controller: new AbortController(),
    results: {},
    firstBackAt: null,
    timer: null,
    settled: false,
    stopped: false,
  };
  const lineCount = text.split(/\r?\n/).length;

  function clearTimer() {
    if (run.timer !== null) clearTimeout(run.timer);
    run.timer = null;
  }

  function update(stopWaiting: boolean) {
    if (run.stopped || run.settled) return;
    const settled = settleReadings(run.results, lineCount, stopWaiting);
    if (settled.kind === "waiting") {
      const delay = stragglerDelay(run.results, run.firstBackAt, Date.now());
      if (delay !== null && run.timer === null) {
        run.timer = setTimeout(() => update(true), delay);
      }
      onUpdate(settled);
      return;
    }
    run.settled = true;
    clearTimer();
    onUpdate(settled);
  }

  for (const reading of READING_NUMBERS) {
    const reply = requestTransliteration(text, reading, fetchImpl, run.controller.signal);
    reply.then((result) => {
      // A reply after stop(), from a run that was replaced or cleared, or one after the cut-off, is dropped.
      if (run.stopped || run.settled) return;
      if (!result.ok && result.aborted) return;
      run.results[reading] = result;
      // The straggler countdown starts from the first successful reading.
      if (result.ok) run.firstBackAt ??= Date.now();
      update(false);
    });
  }

  return function stop() {
    run.stopped = true;
    run.controller.abort();
    clearTimer();
  };
}
