"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type Ref } from "react";
import { MergedText } from "@/app/merged-text";
import { ReadingDots } from "@/app/reading-dots";
import type { Statuses } from "@/app/settle-readings";
import { lineDelayMs, readingsNote } from "@/app/view-helpers";
import { mergedText, type Choices, type Merged, type Span } from "@/lib/merge-readings";
import { READING_NUMBERS } from "@/lib/readings";

const LONG_WAIT_MS = 8000;
const COPIED_MS = 1600;

export function OutputPanel({
  phase,
  choices,
  onPick,
  ref,
}: {
  phase:
    | { kind: "loading"; rows: number[]; statuses: Statuses }
    | { kind: "done"; merged: Merged; statuses: Statuses };
  choices: Choices;
  onPick: (line: number, span: Span, chosenIndex: number) => void;
  ref?: Ref<HTMLElement>;
}) {
  const loading = phase.kind === "loading";
  const [slow, setSlow] = useState(false);
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), LONG_WAIT_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy(latin: string) {
    try {
      await navigator.clipboard.writeText(latin);
      setCopied(true);
    } catch {
      // No clipboard access: select the text so it can be copied by hand.
      const element = textRef.current;
      const selection = window.getSelection();
      if (!element || !selection) return;
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
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
            <button
              type="button"
              onClick={() => copy(mergedText(phase.merged, choices))}
              className="inline-flex h-11 items-center gap-2 rounded-sm px-4 text-[15px] font-medium transition-[background-color,transform] duration-100 ease-brand hover:bg-ink/6 active:scale-[0.98]"
            >
              {copied ? (
                <CheckIcon size={16} weight="bold" aria-hidden="true" />
              ) : (
                <CopyIcon size={16} weight="bold" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {phase.kind === "loading" ? (
        <>
          <div aria-hidden="true" className="text-[22px] md:text-[26px]">
            {phase.rows.map((width, i) => (
              <div key={i} className="flex h-[1.55em] items-center">
                {width > 0 && (
                  <div
                    className="h-[0.5em] animate-bar-pulse rounded-full bg-ink opacity-[0.07]"
                    style={{ width: `${width}%`, animationDelay: `${i * 80}ms` }}
                  />
                )}
              </div>
            ))}
          </div>
          {slow && (
            <p className="mt-4 text-[15px] leading-[1.4] text-ink/60">
              Longer passages can take up to a minute.
            </p>
          )}
        </>
      ) : (
        <>
          <div ref={textRef}>
            <MergedText merged={phase.merged} choices={choices} onPick={onPick} />
          </div>
          <p
            className="mt-4 animate-line-rise text-[15px] leading-[1.4] text-ink/60"
            style={{ animationDelay: `${lineDelayMs(phase.merged.lines.length)}ms` }}
          >
            {readingsNote(
              phase.merged.readings.length,
              phase.merged.lines.flat().filter((token) => token.kind === "span").length,
              Object.keys(choices).length,
            )}
          </p>
        </>
      )}
    </section>
  );
}
