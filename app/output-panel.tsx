"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type Ref } from "react";
import { lineDelayMs } from "@/app/view-helpers";

const LONG_WAIT_MS = 8000;
const COPIED_MS = 1600;

export function OutputPanel({
  phase,
  ref,
}: {
  phase: { kind: "loading"; rows: number[] } | { kind: "done"; latin: string };
  ref?: Ref<HTMLElement>;
}) {
  const loading = phase.kind === "loading";
  const [slow, setSlow] = useState(false);
  const [copied, setCopied] = useState(false);
  const latinRef = useRef<HTMLParagraphElement>(null);

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
      const element = latinRef.current;
      const selection = window.getSelection();
      if (!element || !selection) return;
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

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
        {phase.kind === "done" && (
          <button
            type="button"
            onClick={() => copy(phase.latin)}
            className="inline-flex h-11 items-center gap-2 rounded-sm px-4 text-[15px] font-medium transition-[background-color,transform] duration-100 ease-brand hover:bg-ink/6 active:scale-[0.98]"
          >
            {copied ? (
              <CheckIcon size={16} weight="bold" aria-hidden="true" />
            ) : (
              <CopyIcon size={16} weight="bold" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
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
        <p ref={latinRef} className="text-[22px] leading-[1.55] tracking-[-0.01em] md:text-[26px]">
          {phase.latin.split(/\r?\n/).map((line, i) => (
            <span
              key={i}
              className="block min-h-[1.55em] animate-line-rise"
              style={{ animationDelay: `${lineDelayMs(i)}ms` }}
            >
              {line}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
