"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { useEffect, useState, type Ref } from "react";
import { counterState } from "@/app/view-helpers";

export function Composer({
  text,
  busy,
  textareaRef,
  onTextChange,
  onSubmit,
  onClear,
}: {
  text: string;
  busy: boolean; // a request for exactly this text is running
  textareaRef: Ref<HTMLTextAreaElement>;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  // Set after mount, because the server can't know the visitor's platform.
  const [shortcut, setShortcut] = useState("");
  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘ Enter" : "Ctrl Enter");
  }, []);

  const hasText = text.trim() !== "";
  const counter = counterState(text);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="rounded-md border border-ink bg-paper focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink"
    >
      <label htmlFor="coptic" className="sr-only">
        Coptic text
      </label>
      <textarea
        id="coptic"
        ref={textareaRef}
        lang="cop"
        spellCheck={false}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder="Paste or type Coptic text"
        className="block max-h-[60vh] min-h-[200px] w-full resize-none border-0 bg-transparent px-[22px] pt-[22px] pb-2 font-coptic text-[22px] leading-[1.6] text-ink outline-none field-sizing-content placeholder:font-sans placeholder:text-[18px] placeholder:text-ink/60 md:min-h-[280px]"
      />
      <div className="flex min-h-[68px] items-center justify-end gap-2 pt-2 pr-3 pb-3 pl-[22px]">
        <span
          className={`mr-auto font-mono text-[12px] leading-[1.4] ${
            counter.over ? "text-ink underline underline-offset-[3px]" : "text-ink/60"
          }`}
        >
          {counter.visible ? counter.label : ""}
        </span>
        {/* Hidden and inert while the box is empty, so keyboards and screen readers skip them. */}
        <div
          inert={!hasText}
          className={`flex items-center gap-2 transition-[opacity,transform,visibility] duration-200 ease-brand ${
            hasText ? "visible translate-y-0 opacity-100" : "invisible translate-y-1.5 opacity-0"
          }`}
        >
          <span
            aria-hidden="true"
            className="mr-1 hidden font-mono text-[12px] leading-[1.4] text-ink/60 md:inline"
          >
            {shortcut}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-11 items-center rounded-sm px-4 text-[15px] font-medium whitespace-nowrap transition-[background-color,transform] duration-100 ease-brand hover:bg-ink/6 active:scale-[0.98]"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 items-center gap-2 rounded-sm bg-ink px-4 text-[15px] font-medium whitespace-nowrap text-white transition-[opacity,transform] duration-200 ease-brand enabled:hover:opacity-86 enabled:active:scale-[0.98] disabled:cursor-progress disabled:opacity-70"
          >
            {busy ? (
              <span>
                Transliterating
                <span aria-hidden="true" className="inline-block w-[1.2em] text-left">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="animate-dot-blink" style={{ animationDelay: `${i * 200}ms` }}>
                      .
                    </span>
                  ))}
                </span>
              </span>
            ) : (
              "Transliterate"
            )}
            <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </div>
    </form>
  );
}
