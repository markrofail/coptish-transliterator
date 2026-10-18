"use client";

import { WarningCircleIcon } from "@phosphor-icons/react";
import { useEffect, useState, type Ref } from "react";
import { MergedText } from "@/app/merged-text";
import type { Statuses } from "@/app/settle-readings";
import { lineDelayMs, readingsNote } from "@/app/view-helpers";
import { spanCount, type Choices, type Merged, type Span } from "@/lib/merge-readings";

const LONG_WAIT_MS = 8000;

export type PartPhase =
  | { kind: "loading"; rows: number[]; statuses: Statuses }
  | { kind: "done"; merged: Merged; statuses: Statuses }
  | { kind: "error"; message: string; retryable: boolean };

/** What sits under an output header: the skeleton, and the long-wait line, while loading; then the text and its note. */
export function PartBody({
  phase,
  choices,
  onPick,
  textRef,
}: {
  phase: Extract<PartPhase, { kind: "loading" | "done" }>;
  choices: Choices;
  onPick: (line: number, span: Span, chosenIndex: number) => void;
  textRef?: Ref<HTMLDivElement>; // the text's container, for selecting it by hand
}) {
  const loading = phase.kind === "loading";
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), LONG_WAIT_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  if (phase.kind === "loading") {
    return (
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
    );
  }

  return (
    <>
      <div ref={textRef}>
        <MergedText merged={phase.merged} choices={choices} onPick={onPick} />
      </div>
      <p
        className="mt-4 animate-line-rise text-[15px] leading-[1.4] text-ink/60"
        style={{ animationDelay: `${lineDelayMs(phase.merged.lines.length)}ms` }}
      >
        {readingsNote(phase.merged.readings.length, spanCount(phase.merged), Object.keys(choices).length)}
      </p>
    </>
  );
}

/** Today's error line: an alert icon, the message, and Try again when it can be retried. */
export function Warning({
  message,
  onRetry,
  alert = false,
}: {
  message: string;
  onRetry?: () => void;
  alert?: boolean; // an error, announced at once; otherwise a note
}) {
  return (
    <div role={alert ? "alert" : undefined} className="mt-3 flex items-center gap-2 text-[15px] leading-[1.4]">
      <WarningCircleIcon size={18} weight="bold" aria-hidden="true" className="shrink-0" />
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-11 shrink-0 px-1 font-medium underline underline-offset-[3px]"
        >
          Try again
        </button>
      )}
    </div>
  );
}
