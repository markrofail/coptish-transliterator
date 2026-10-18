"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type Ref } from "react";
import { PartBody, type PartPhase } from "@/app/part-body";
import { ReadingDots } from "@/app/reading-dots";
import { mergedText, type Choices, type Span } from "@/lib/merge-readings";
import { READING_NUMBERS } from "@/lib/readings";

const COPIED_MS = 1600;

export function OutputPanel({
  phase,
  choices,
  onPick,
  ref,
}: {
  phase: Extract<PartPhase, { kind: "loading" | "done" }>;
  choices: Choices;
  onPick: (line: number, span: Span, chosenIndex: number) => void;
  ref?: Ref<HTMLElement>;
}) {
  const loading = phase.kind === "loading";
  const textRef = useRef<HTMLDivElement>(null);

  async function copy(latin: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(latin);
      return true;
    } catch {
      // No clipboard access: select the text so it can be copied by hand.
      const element = textRef.current;
      const selection = window.getSelection();
      if (!element || !selection) return false;
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
      return false;
    }
  }

  const anyFailed = READING_NUMBERS.some((reading) => phase.statuses[reading] === "failed");

  return (
    <section
      ref={ref}
      aria-live="polite"
      aria-busy={loading}
      aria-labelledby="latin-label"
      className="mt-9 scroll-mt-4 md:mt-[58px]"
    >
      <div className="mb-4 flex min-h-11 items-center justify-between border-t border-ink pt-2">
        <h2 id="latin-label" className="font-mono text-[12px] leading-[1.4] text-ink/60">
          Latin
        </h2>
        {phase.kind === "loading" ? (
          <ReadingDots statuses={phase.statuses} withLabel />
        ) : (
          <div className="flex items-center gap-1">
            {anyFailed && <ReadingDots statuses={phase.statuses} withLabel={false} />}
            <CopyButton label="Copy" onCopy={() => copy(mergedText(phase.merged, choices))} />
          </div>
        )}
      </div>
      <PartBody phase={phase} choices={choices} onPick={onPick} textRef={textRef} />
    </section>
  );
}

/** A header's Copy button. `onCopy` says whether the text reached the clipboard; then it reads Copied for a moment. */
export function CopyButton({ label, onCopy }: { label: string; onCopy: () => Promise<boolean> }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        if (await onCopy()) setCopied(true);
      }}
      className="inline-flex h-11 items-center gap-2 rounded-sm px-4 text-[15px] font-medium transition-[background-color,transform] duration-100 ease-brand hover:bg-ink/6 active:scale-[0.98]"
    >
      {copied ? (
        <CheckIcon size={16} weight="bold" aria-hidden="true" />
      ) : (
        <CopyIcon size={16} weight="bold" aria-hidden="true" />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}
