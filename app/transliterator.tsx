"use client";

import { useEffect, useRef, useState } from "react";
import { Composer } from "@/app/composer";
import { ExampleList } from "@/app/example-list";
import type { Example } from "@/app/examples";
import { HymnPanel } from "@/app/hymn-panel";
import { OutputPanel } from "@/app/output-panel";
import { Warning } from "@/app/part-body";
import { runReadings } from "@/app/run-readings";
import type { Statuses } from "@/app/settle-readings";
import { skeletonRows } from "@/app/view-helpers";
import {
  beginPart,
  beginWalk,
  choose,
  finishWalk,
  nextPart,
  partLoading,
  setAllOpen,
  settlePart,
  togglePart,
  type Walk,
} from "@/app/walk-through";
import type { Choices, Merged, Span } from "@/lib/merge-readings";
import { splitParts } from "@/lib/split-parts";
import { MAX_PASTE_LENGTH, validateInput } from "@/lib/validate";

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; sentText: string; rows: number[]; statuses: Statuses }
  | { kind: "done"; merged: Merged; statuses: Statuses }
  | { kind: "error"; message: string; retryable: boolean }
  // A paste of more than one part, walked through part by part. Its parts were fixed at the start.
  | { kind: "hymn"; walk: Walk };

const DESKTOP = "(min-width: 768px)";

export function Transliterator() {
  const [text, setText] = useState("");
  const [selectedId, setSelectedId] = useState<Example["id"] | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // Keys the output panel, so each run starts with fresh panel state.
  const [runId, setRunId] = useState(0);
  // Counts runs and parts started: the page scrolls when one starts, not on every reply.
  const [starts, setStarts] = useState(0);
  const [choices, setChoices] = useState<Choices>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLElement>(null);
  const currentPartRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const lastSentRef = useRef("");

  const busy =
    (phase.kind === "loading" && text === phase.sentText) ||
    (phase.kind === "hymn" && partLoading(phase.walk) && text === phase.walk.sentText);

  useEffect(() => {
    // Only with a mouse or trackpad, so a phone keyboard doesn't pop up on load.
    if (matchMedia("(pointer: fine)").matches) textareaRef.current?.focus();
    return () => stopRun();
  }, []);

  useEffect(() => {
    const loading = phase.kind === "loading" || (phase.kind === "hymn" && partLoading(phase.walk));
    if (!loading || !outputRef.current) return;
    // A later part scrolls to its own row. That row can also sit above the viewport, once the
    // long part above it folds.
    const part = phase.kind === "hymn" && phase.walk.current > 0 ? currentPartRef.current : null;
    const target = part ?? outputRef.current;
    const { top } = target.getBoundingClientRect();
    const onPhone = !matchMedia(DESKTOP).matches;
    if (onPhone || top > window.innerHeight || (part !== null && top < 0)) {
      const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    }
  }, [starts]);

  function charsPerRow(): number {
    const width = columnRef.current?.clientWidth ?? 0;
    const fontPx = matchMedia(DESKTOP).matches ? 26 : 22;
    return Math.max(16, Math.floor(width / (fontPx * 0.5)));
  }

  // Cancels the run in progress, so none of its replies or its timer can touch the page.
  function stopRun() {
    stopRef.current?.();
    stopRef.current = null;
  }

  function run(raw: string) {
    stopRun();
    const input = validateInput(raw, MAX_PASTE_LENGTH);
    if (!input.ok) {
      setPhase({ kind: "error", message: input.message, retryable: false });
      return;
    }
    lastSentRef.current = raw;
    setRunId((id) => id + 1);
    const parts = splitParts(input.text);
    if (parts.length > 1) {
      const walk = beginWalk(raw, parts);
      setPhase({ kind: "hymn", walk });
      runPart(walk, 0);
      return;
    }
    const rows = skeletonRows(input.text, charsPerRow());
    setStarts((count) => count + 1);
    setChoices({});
    setPhase({
      kind: "loading",
      sentText: raw,
      rows,
      statuses: { 1: "waiting", 2: "waiting", 3: "waiting" },
    });
    stopRef.current = runReadings(input.text, (settled) => {
      if (settled.kind === "waiting") {
        setPhase({ kind: "loading", sentText: raw, rows, statuses: settled.statuses });
      } else if (settled.kind === "done") {
        setPhase({ kind: "done", merged: settled.merged, statuses: settled.statuses });
      } else {
        setPhase(settled);
      }
    });
  }

  function updateWalk(change: (walk: Walk) => Walk) {
    setPhase((current) => (current.kind === "hymn" ? { kind: "hymn", walk: change(current.walk) } : current));
  }

  // Runs part `index` of the walk-through: part 1, the next part, or a retry. Only the part asked
  // for is fetched. A new run, Clear or an example press stops it, through stopRun.
  function runPart(walk: Walk, index: number) {
    stopRun();
    const partText = walk.parts[index].part.text;
    const rows = skeletonRows(partText, charsPerRow());
    setStarts((count) => count + 1);
    updateWalk((current) => beginPart(current, index, rows));
    stopRef.current = runReadings(partText, (settled) =>
      updateWalk((current) => settlePart(current, index, settled)),
    );
  }

  function handleNext() {
    if (phase.kind !== "hymn") return;
    updateWalk(nextPart);
    runPart(phase.walk, phase.walk.current + 1);
  }

  // Every pick goes through here, with the number of the part it was made in: 1 for a short
  // paste. Saving choices for the nightly analysis would be added here later (three-readings
  // spec, section 8), and the part number lets a stored choice be traced to its place in the
  // hymn; today it only updates the text.
  function recordChoice(part: number, line: number, span: Span, chosenIndex: number) {
    if (phase.kind === "hymn") updateWalk((walk) => choose(walk, part - 1, span.id, chosenIndex));
    else setChoices((current) => ({ ...current, [span.id]: chosenIndex }));
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
          <Warning
            alert
            message={phase.message}
            onRetry={phase.retryable ? () => run(lastSentRef.current) : undefined}
          />
        )}
        {(phase.kind === "loading" || phase.kind === "done") && (
          <OutputPanel
            key={runId}
            phase={phase}
            choices={choices}
            onPick={(line, span, chosenIndex) => recordChoice(1, line, span, chosenIndex)}
            ref={outputRef}
          />
        )}
        {phase.kind === "hymn" && (
          <HymnPanel
            key={runId}
            parts={phase.walk.parts}
            current={phase.walk.current}
            finished={phase.walk.finished}
            onNext={handleNext}
            onFinish={() => updateWalk(finishWalk)}
            onRetry={(index) => runPart(phase.walk, index)}
            onToggle={(index) => updateWalk((walk) => togglePart(walk, index))}
            onShowAll={() => updateWalk((walk) => setAllOpen(walk, true))}
            onFoldAll={() => updateWalk((walk) => setAllOpen(walk, false))}
            onPick={recordChoice}
            ref={outputRef}
            currentRef={currentPartRef}
          />
        )}
      </div>
      <aside className="md:sticky md:top-8">
        <ExampleList selectedId={selectedId} onPick={handlePick} />
      </aside>
    </div>
  );
}
