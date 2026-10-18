"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { useEffect, useRef, type Ref } from "react";
import { CopyButton } from "@/app/output-panel";
import { PartBody, Warning } from "@/app/part-body";
import { ReadingDots } from "@/app/reading-dots";
import { foldedLabel } from "@/app/view-helpers";
import { hymnText, type HymnPart } from "@/app/walk-through";
import { isIncomplete, type Span } from "@/lib/merge-readings";
import { READING_NUMBERS } from "@/lib/readings";

const PRIMARY =
  "inline-flex h-11 items-center gap-2 rounded-sm bg-ink px-4 text-[15px] font-medium whitespace-nowrap text-white transition-[opacity,transform] duration-200 ease-brand hover:opacity-86 active:scale-[0.98]";
// min-w-11: "Hide" alone is narrower than the 44px target.
const LINK = "h-11 min-w-11 shrink-0 px-1 text-center text-[15px] font-medium underline underline-offset-[3px]";

/** The output for a paste of more than one part: finished parts fold into rows, and the part on screen sits last. */
export function HymnPanel({
  parts,
  current,
  finished,
  onNext,
  onFinish,
  onRetry,
  onToggle,
  onShowAll,
  onFoldAll,
  onPick,
  ref,
  currentRef,
}: {
  parts: readonly HymnPart[];
  current: number;
  finished: boolean;
  onNext(): void;
  onFinish(): void;
  onRetry(index: number): void;
  onToggle(index: number): void;
  onShowAll(): void;
  onFoldAll(): void;
  onPick(part: number, line: number, span: Span, chosenIndex: number): void; // part counts from 1
  ref?: Ref<HTMLElement>;
  currentRef?: Ref<HTMLDivElement>; // the row of the part on screen, so the page can scroll to it
}) {
  const partLabelRef = useRef<HTMLHeadingElement>(null);
  const wholeRef = useRef<HTMLButtonElement>(null);
  // Next part, Finish and Try again go away once pressed, so focus moves on: to the part that
  // starts, without scrolling (the page scrolls to it by its own rule), or to Show the whole hymn.
  const focusNext = useRef<"part" | "whole" | null>(null);

  useEffect(() => {
    if (focusNext.current === "part") partLabelRef.current?.focus({ preventScroll: true });
    if (focusNext.current === "whole") wholeRef.current?.focus();
    focusNext.current = null;
  });

  const done = parts.filter((entry) => entry.phase?.kind === "done").length;
  const allOpen = parts.every((entry) => entry.open);

  // Both ways of copying start inside the press, before anything is awaited: iOS refuses
  // clipboard writes made outside it.
  function copyAll(): Promise<boolean> {
    const text = hymnText(parts);
    if (!navigator.clipboard?.writeText) return Promise.resolve(copyThroughTextBox(text));
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => copyThroughTextBox(text),
    );
  }

  return (
    <section ref={ref} aria-labelledby="latin-label" className="mt-9 scroll-mt-4 md:mt-[58px]">
      <div className="flex min-h-11 items-center justify-between border-t border-ink pt-2">
        <h2 id="latin-label" className="font-mono text-[12px] leading-[1.4] text-ink/60">
          {done === parts.length ? "Latin · whole hymn" : "Latin"}
        </h2>
        {done > 0 && <CopyButton label="Copy all" onCopy={copyAll} />}
      </div>

      {parts.map((entry, index) => {
        const pick = (line: number, span: Span, chosenIndex: number) => onPick(index + 1, line, span, chosenIndex);
        if (index === current && !finished) {
          return (
            <CurrentPart
              key={index}
              entry={entry}
              index={index}
              count={parts.length}
              rowRef={currentRef}
              labelRef={partLabelRef}
              onNext={() => {
                focusNext.current = "part";
                onNext();
              }}
              onFinish={() => {
                focusNext.current = "whole";
                onFinish();
              }}
              onRetry={() => {
                focusNext.current = "part";
                onRetry(index);
              }}
              onPick={pick}
            />
          );
        }
        if (index > current || entry.phase?.kind !== "done") return null;
        const { phase, choices, open } = entry;
        return (
          <div key={index}>
            <div className="flex min-h-12 items-center justify-between gap-4 border-t border-ink/12">
              <h3 className="text-[15px] leading-[1.4]">
                Part {index + 1} ·{" "}
                <span className="font-mono text-[12px] text-ink/60">
                  {foldedLabel(entry.part.text, phase.merged, Object.keys(choices).length)}
                </span>
              </h3>
              <button
                type="button"
                aria-expanded={open}
                aria-label={`${open ? "Hide" : "Show"} part ${index + 1}`}
                onClick={() => onToggle(index)}
                className={LINK}
              >
                {open ? "Hide" : "Show"}
              </button>
            </div>
            {open && (
              <div className="pt-2 pb-[22px]">
                <PartBody phase={phase} choices={choices} onPick={pick} />
              </div>
            )}
          </div>
        );
      })}

      {finished && (
        <>
          <p className="border-t border-ink/12 pt-4 text-[15px] leading-[1.4] text-ink/60">
            All {parts.length} parts done
          </p>
          <button
            ref={wholeRef}
            type="button"
            onClick={allOpen ? onFoldAll : onShowAll}
            className={`mt-4 ${PRIMARY}`}
          >
            {allOpen ? "Fold all" : "Show the whole hymn"}
          </button>
        </>
      )}
    </section>
  );
}

/** The part on screen: its row, then its skeleton or text, then Next part or Finish; or its error. */
function CurrentPart({
  entry,
  index,
  count,
  rowRef,
  labelRef,
  onNext,
  onFinish,
  onRetry,
  onPick,
}: {
  entry: HymnPart;
  index: number;
  count: number;
  rowRef?: Ref<HTMLDivElement>;
  labelRef: Ref<HTMLHeadingElement>;
  onNext: () => void;
  onFinish: () => void;
  onRetry: () => void;
  onPick: (line: number, span: Span, chosenIndex: number) => void;
}) {
  const { phase, choices, lineCount } = entry;
  if (!phase) return null;
  const last = index === count - 1;
  const anyFailed =
    phase.kind === "done" && READING_NUMBERS.some((reading) => phase.statuses[reading] === "failed");

  return (
    <div aria-live="polite" aria-busy={phase.kind === "loading"}>
      {/* Part 1 sits right under the header's rule, so it needs no hairline of its own. Scrolled
          to, the row keeps the folded row above it in view, so the reader sees that part fold. */}
      <div
        ref={rowRef}
        className={`flex min-h-11 scroll-mt-16 items-center justify-between gap-4 ${index > 0 ? "border-t border-ink/12" : ""}`}
      >
        <h3 ref={labelRef} tabIndex={-1} className="font-mono text-[12px] leading-[1.4] text-ink/60">
          Part {index + 1} of {count}
        </h3>
        {phase.kind === "loading" && <ReadingDots statuses={phase.statuses} withLabel />}
        {anyFailed && <ReadingDots statuses={phase.statuses} withLabel={false} />}
      </div>

      {phase.kind === "error" ? (
        <Warning alert message={phase.message} onRetry={phase.retryable ? onRetry : undefined} />
      ) : (
        <div className="mt-4">
          {/* Keyed by kind, so a retried part starts its long-wait timer afresh. */}
          <PartBody key={phase.kind} phase={phase} choices={choices} onPick={onPick} />
          {phase.kind === "done" && (
            <>
              {isIncomplete(phase.merged, lineCount) && (
                <Warning message="Some lines may be missing from this part" onRetry={onRetry} />
              )}
              {/* Always enabled: settling the marks is optional. */}
              <div className="mt-[22px]">
                <button type="button" onClick={last ? onFinish : onNext} className={PRIMARY}>
                  {last ? (
                    "Finish"
                  ) : (
                    <>
                      Next part
                      <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// No clipboard access. Folded parts aren't on the page to select by hand, so copy through a
// hidden text box instead. True only if the browser says the copy worked.
function copyThroughTextBox(text: string): boolean {
  const box = document.createElement("textarea");
  box.value = text;
  // Editable, since iOS often won't select a read-only box; 16px, so focusing it doesn't zoom
  // the page; pinned in view, so selecting it doesn't scroll.
  box.style.position = "fixed";
  box.style.top = "0";
  box.style.left = "0";
  box.style.fontSize = "16px";
  box.style.opacity = "0";
  const focused = document.activeElement;
  document.body.append(box);
  try {
    box.select();
    box.setSelectionRange(0, box.value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    box.remove();
    if (focused instanceof HTMLElement) focused.focus();
  }
}
