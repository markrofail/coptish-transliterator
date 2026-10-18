import type { ReadingStatus, Statuses } from "@/app/settle-readings";
import { readingsBackLabel } from "@/app/view-helpers";
import { READING_NUMBERS } from "@/lib/readings";

const DOT: Record<ReadingStatus, string> = {
  waiting: "animate-dot-blink",
  back: "bg-ink",
  failed: "border-dashed opacity-45",
};

/** One dot per reading, in reading order. The count is text, so screen readers get it. */
export function ReadingDots({ statuses, withLabel }: { statuses: Statuses; withLabel: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        {READING_NUMBERS.map((reading) => (
          <span
            key={reading}
            className={`size-2 rounded-full border-[1.5px] border-ink transition-[background-color] duration-200 ease-brand ${DOT[statuses[reading]]}`}
          />
        ))}
      </span>
      <span className={withLabel ? "font-mono text-[12px] leading-[1.4] text-ink/60" : "sr-only"}>
        {readingsBackLabel(statuses)}
      </span>
    </span>
  );
}
