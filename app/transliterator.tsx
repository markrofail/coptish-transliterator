"use client";

import { WarningCircleIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Composer } from "@/app/composer";
import { ExampleList } from "@/app/example-list";
import type { Example } from "@/app/examples";
import { OutputPanel } from "@/app/output-panel";
import { requestTransliteration } from "@/app/request-transliteration";
import {
  settleReadings,
  stragglerDelay,
  type Results,
  type Statuses,
} from "@/app/settle-readings";
import { skeletonRows } from "@/app/view-helpers";
import type { Merged } from "@/lib/merge-readings";
import { READING_NUMBERS } from "@/lib/readings";
import { validateInput } from "@/lib/validate";

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; sentText: string; rows: number[]; statuses: Statuses }
  | { kind: "done"; merged: Merged; statuses: Statuses }
  | { kind: "error"; message: string; retryable: boolean };

// One press of Transliterate: three readings sharing one controller.
type Run = {
  controller: AbortController;
  results: Results;
  firstBackAt: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  settled: boolean;
};

const DESKTOP = "(min-width: 768px)";

export function Transliterator() {
  const [text, setText] = useState("");
  const [selectedId, setSelectedId] = useState<Example["id"] | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // Keys the output panel, so each run starts with fresh panel state.
  const [runId, setRunId] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLElement>(null);
  const runRef = useRef<Run | null>(null);
  const lastSentRef = useRef("");

  const busy = phase.kind === "loading" && text === phase.sentText;

  useEffect(() => {
    // Only with a mouse or trackpad, so a phone keyboard doesn't pop up on load.
    if (matchMedia("(pointer: fine)").matches) textareaRef.current?.focus();
    return () => stopRun();
  }, []);

  // On a new run only: replies update the loading phase too, and shouldn't scroll the page back.
  useEffect(() => {
    if (phase.kind !== "loading" || !outputRef.current) return;
    const output = outputRef.current;
    const onPhone = !matchMedia(DESKTOP).matches;
    if (onPhone || output.getBoundingClientRect().top > window.innerHeight) {
      const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      output.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    }
  }, [runId]);

  function charsPerRow(): number {
    const width = columnRef.current?.clientWidth ?? 0;
    const fontPx = matchMedia(DESKTOP).matches ? 26 : 22;
    return Math.max(16, Math.floor(width / (fontPx * 0.5)));
  }

  // Cancels the run in progress, so none of its replies or its timer can touch the page.
  function stopRun() {
    const current = runRef.current;
    if (!current) return;
    current.controller.abort();
    if (current.timer !== null) clearTimeout(current.timer);
    runRef.current = null;
  }

  function run(raw: string) {
    stopRun();
    const input = validateInput(raw);
    if (!input.ok) {
      setPhase({ kind: "error", message: input.message, retryable: false });
      return;
    }
    const current: Run = {
      controller: new AbortController(),
      results: {},
      firstBackAt: null,
      timer: null,
      settled: false,
    };
    runRef.current = current;
    lastSentRef.current = raw;
    const lineCount = input.text.split(/\r?\n/).length;
    const rows = skeletonRows(input.text, charsPerRow());
    setRunId((id) => id + 1);
    setPhase({
      kind: "loading",
      sentText: raw,
      rows,
      statuses: { 1: "waiting", 2: "waiting", 3: "waiting" },
    });

    function update(stopWaiting: boolean) {
      if (runRef.current !== current || current.settled) return;
      const settled = settleReadings(current.results, lineCount, stopWaiting);
      if (settled.kind === "waiting") {
        setPhase({ kind: "loading", sentText: raw, rows, statuses: settled.statuses });
        const delay = stragglerDelay(current.results, current.firstBackAt, Date.now());
        if (delay !== null && current.timer === null) {
          current.timer = setTimeout(() => update(true), delay);
        }
        return;
      }
      current.settled = true;
      if (current.timer !== null) clearTimeout(current.timer);
      current.timer = null;
      setPhase(
        settled.kind === "done"
          ? { kind: "done", merged: settled.merged, statuses: settled.statuses }
          : settled,
      );
    }

    for (const reading of READING_NUMBERS) {
      const reply = requestTransliteration(input.text, reading, fetch, current.controller.signal);
      reply.then((result) => {
        // A reply from an older run, or one after the cut-off, is dropped.
        if (runRef.current !== current || current.settled) return;
        if (!result.ok && result.aborted) return;
        current.results[reading] = result;
        // The straggler countdown starts from the first successful reading.
        if (result.ok) current.firstBackAt ??= Date.now();
        update(false);
      });
    }
  }

  function handleTextChange(value: string) {
    setText(value);
    setSelectedId(null);
  }

  function handleSubmit() {
    if (busy || text.trim() === "") return;
    run(text);
  }

  function handleClear() {
    stopRun();
    setText("");
    setSelectedId(null);
    setPhase({ kind: "idle" });
    textareaRef.current?.focus();
  }

  function handlePick(example: Example) {
    setText(example.coptic);
    setSelectedId(example.id);
    run(example.coptic);
  }

  return (
    // Empty onClick: iOS Safari then sends clicks for taps on plain text, which close the chooser.
    <div
      onClick={() => {}}
      className="grid gap-[22px] md:grid-cols-[minmax(0,1fr)_248px] md:items-start md:gap-[58px]"
    >
      <div ref={columnRef} className="min-w-0">
        <Composer
          text={text}
          busy={busy}
          textareaRef={textareaRef}
          onTextChange={handleTextChange}
          onSubmit={handleSubmit}
          onClear={handleClear}
        />
        {phase.kind === "error" && (
          <div role="alert" className="mt-3 flex items-center gap-2 text-[15px] leading-[1.4]">
            <WarningCircleIcon size={18} weight="bold" aria-hidden="true" className="shrink-0" />
            <span>{phase.message}</span>
            {phase.retryable && (
              <button
                type="button"
                onClick={() => run(lastSentRef.current)}
                className="h-11 shrink-0 px-1 font-medium underline underline-offset-[3px]"
              >
                Try again
              </button>
            )}
          </div>
        )}
        {(phase.kind === "loading" || phase.kind === "done") && (
          <OutputPanel key={runId} phase={phase} ref={outputRef} />
        )}
      </div>
      <aside className="md:sticky md:top-8">
        <ExampleList selectedId={selectedId} onPick={handlePick} />
      </aside>
    </div>
  );
}
