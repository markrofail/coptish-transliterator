"use client";

import { WarningCircleIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Composer } from "@/app/composer";
import { ExampleList } from "@/app/example-list";
import type { Example } from "@/app/examples";
import { OutputPanel } from "@/app/output-panel";
import { requestTransliteration } from "@/app/request-transliteration";
import { skeletonRows } from "@/app/view-helpers";
import { validateInput } from "@/lib/validate";

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; sentText: string; rows: number[] }
  | { kind: "done"; latin: string }
  | { kind: "error"; message: string; retryable: boolean };

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
  const controllerRef = useRef<AbortController | null>(null);
  const lastSentRef = useRef("");

  const busy = phase.kind === "loading" && text === phase.sentText;

  useEffect(() => {
    // Only with a mouse or trackpad, so a phone keyboard doesn't pop up on load.
    if (matchMedia("(pointer: fine)").matches) textareaRef.current?.focus();
    return () => controllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (phase.kind !== "loading" || !outputRef.current) return;
    const output = outputRef.current;
    const onPhone = !matchMedia(DESKTOP).matches;
    if (onPhone || output.getBoundingClientRect().top > window.innerHeight) {
      const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      output.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    }
  }, [phase]);

  function charsPerRow(): number {
    const width = columnRef.current?.clientWidth ?? 0;
    const fontPx = matchMedia(DESKTOP).matches ? 26 : 22;
    return Math.max(16, Math.floor(width / (fontPx * 0.5)));
  }

  async function run(raw: string) {
    controllerRef.current?.abort();
    controllerRef.current = null;
    const input = validateInput(raw);
    if (!input.ok) {
      setPhase({ kind: "error", message: input.message, retryable: false });
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    lastSentRef.current = raw;
    setRunId((id) => id + 1);
    setPhase({ kind: "loading", sentText: raw, rows: skeletonRows(input.text, charsPerRow()) });

    const result = await requestTransliteration(input.text, 1, fetch, controller.signal);
    if (result.ok) {
      setPhase({ kind: "done", latin: result.latin });
    } else if (!result.aborted) {
      setPhase({ kind: "error", message: result.message, retryable: result.retryable });
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
    controllerRef.current?.abort();
    controllerRef.current = null;
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
    <div className="grid gap-[22px] md:grid-cols-[minmax(0,1fr)_248px] md:items-start md:gap-[58px]">
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
