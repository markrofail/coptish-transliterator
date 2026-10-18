"use client";

import { Fragment, useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { lineDelayMs } from "@/app/view-helpers";
import type { Choices, Merged, Span, Token } from "@/lib/merge-readings";

type MarkState = "default" | "open" | "chosen";

// The mark sits on an inline span inside the button, so it covers the word, not the line height.
const MARK: Record<MarkState, string> = {
  default: "bg-ink/7 shadow-[inset_0_-2px_0_var(--color-ink)] group-hover:bg-ink/12",
  open: "bg-ink text-paper",
  chosen: "shadow-[inset_0_-2px_0_var(--color-ink)] group-hover:bg-ink/6",
};

/** The merged readings, with a button on each span and its chooser under the open span's line. */
export function MergedText({
  merged,
  choices,
  onPick,
}: {
  merged: Merged;
  choices: Choices;
  onPick: (line: number, span: Span, chosenIndex: number) => void;
}) {
  const baseId = useId();
  const [open, setOpen] = useState<{ line: number; id: string } | null>(null);
  const spanRefs = useRef(new Map<string, HTMLButtonElement>());
  const chooserRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const openSpan = () => spanRefs.current.get(open.id);
    // Closes on a click, not a pointerdown: on a phone, closing on pointerdown pulls whatever is
    // below the chooser up under the finger, and the tap misses it. A press on another span
    // is left to that span, which switches the chooser to it.
    function onClick(event: MouseEvent) {
      const target = event.target as Node;
      if (chooserRef.current?.contains(target)) return;
      if ([...spanRefs.current.values()].some((span) => span.contains(target))) return;
      setOpen(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const focused = document.activeElement;
      const hadFocus = chooserRef.current?.contains(focused) || focused === openSpan();
      setOpen(null);
      if (hadFocus) openSpan()?.focus();
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(line: number, span: Span, index: number) {
    onPick(line, span, index);
    setOpen(null);
    spanRefs.current.get(span.id)?.focus();
  }

  const shown = (token: Token) =>
    token.kind === "word" ? token.text : token.alternatives[choices[token.id] ?? 0].text;

  function spanButton(span: Span, line: number): ReactNode {
    const text = shown(span);
    const state: MarkState = open?.id === span.id ? "open" : span.id in choices ? "chosen" : "default";
    return (
      <button
        key={span.id}
        ref={(element) => {
          if (element) spanRefs.current.set(span.id, element);
          else spanRefs.current.delete(span.id);
        }}
        type="button"
        aria-expanded={state === "open"}
        aria-controls={`${baseId}-${span.id}`}
        aria-label={`${text === "" ? "Word left out" : text}, choose a reading`}
        onClick={() => setOpen(state === "open" ? null : { line, id: span.id })}
        // The line height stays the text's; the 44px target is the invisible ::before.
        className={`group relative inline-block select-text before:absolute before:top-1/2 before:left-1/2 before:h-11 before:w-full before:min-w-11 before:-translate-1/2 focus-visible:outline-hidden ${
          // A gap's following space is a margin, so text selected by hand has no double space.
          text === "" ? "mr-[0.25em]" : ""
        }`}
      >
        <span
          className={`rounded-[4px] transition-[background-color,color,box-shadow] duration-100 ease-brand group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ink ${MARK[state]} ${
            // A left-out word is a short marked gap. Its space is generated, so copying skips it.
            text === "" ? "px-[0.3em] after:whitespace-pre after:content-['_']" : "px-0.5"
          }`}
        >
          {text}
        </span>
      </button>
    );
  }

  function lineContent(line: readonly Token[], lineIndex: number): ReactNode[] {
    const parts: ReactNode[] = [];
    let words = "";
    line.forEach((token, k) => {
      if (k > 0 && shown(line[k - 1]) !== "") words += " ";
      if (token.kind === "word") {
        words += token.text;
        return;
      }
      if (words !== "") parts.push(words);
      words = "";
      parts.push(spanButton(token, lineIndex));
    });
    if (words !== "") parts.push(words);
    return parts;
  }

  return (
    <div className="text-[22px] leading-[1.55] tracking-[-0.01em] md:text-[26px]">
      {merged.lines.map((line, lineIndex) => {
        const openSpan =
          open?.line === lineIndex
            ? line.find((token): token is Span => token.kind === "span" && token.id === open.id)
            : undefined;
        return (
          <Fragment key={lineIndex}>
            <div
              className="min-h-[1.55em] animate-line-rise"
              style={{ animationDelay: `${lineDelayMs(lineIndex)}ms` }}
            >
              {lineContent(line, lineIndex)}
            </div>
            {openSpan && (
              <Chooser
                key={openSpan.id}
                ref={chooserRef}
                id={`${baseId}-${openSpan.id}`}
                span={openSpan}
                current={choices[openSpan.id] ?? 0}
                onPick={(index) => pick(lineIndex, openSpan, index)}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function Chooser({
  id,
  span,
  current,
  onPick,
  ref,
}: {
  id: string;
  span: Span;
  current: number;
  onPick: (index: number) => void;
  ref: Ref<HTMLDivElement>;
}) {
  const [active, setActive] = useState(current);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const last = span.alternatives.length - 1;
  const moves: Partial<Record<string, number>> = {
    ArrowDown: Math.min(active + 1, last),
    ArrowUp: Math.max(active - 1, 0),
    Home: 0,
    End: last,
  };

  // Opening focuses the current choice, and the arrow keys move focus from there.
  useEffect(() => {
    rows.current[active]?.focus();
  }, [active]);

  return (
    <div
      ref={ref}
      id={id}
      // Opening is announced through focus, so the output's live region stays quiet about it.
      aria-live="off"
      className="my-2 max-w-[400px] animate-line-rise rounded-md bg-white p-2 text-[18px] leading-[1.4] tracking-normal shadow-card ring-1 ring-ink/12"
    >
      <span id={`${id}-label`} className="mx-1 mt-0.5 mb-2 block font-mono text-[12px] leading-[1.4] text-ink/60">
        Choose a reading
      </span>
      <div
        role="listbox"
        aria-labelledby={`${id}-label`}
        onKeyDown={(event) => {
          const next = moves[event.key];
          if (next === undefined) return;
          event.preventDefault();
          setActive(next);
        }}
      >
        {span.alternatives.map((alternative, index) => {
          const selected = index === current;
          return (
            <button
              key={index}
              ref={(element) => {
                rows.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={selected}
              tabIndex={index === active ? 0 : -1}
              onFocus={() => setActive(index)}
              // A button, so Enter and Space pick it as a click.
              onClick={() => onPick(index)}
              className={`flex min-h-11 w-full items-center justify-between gap-4 rounded-sm px-3 py-2 text-left transition-[background-color] duration-100 ease-brand ${
                selected ? "bg-ink text-paper" : "hover:bg-ink/6"
              }`}
            >
              <span className="min-w-0 wrap-break-word">{alternative.text === "" ? "(leave out)" : alternative.text}</span>
              <span className={`shrink-0 font-mono text-[12px] leading-[1.4] ${selected ? "" : "text-ink/60"}`}>
                {`${alternative.readings.length} of 3`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
