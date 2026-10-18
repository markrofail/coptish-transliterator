import { EXAMPLES, type Example } from "@/app/examples";

export function ExampleList({
  selectedId,
  onPick,
}: {
  selectedId: Example["id"] | null;
  onPick: (example: Example) => void;
}) {
  return (
    <section aria-labelledby="examples-heading">
      <h2 id="examples-heading" className="mb-3 font-mono text-[12px] leading-[1.4] text-ink/60">
        No Coptic on hand? Try one.
      </h2>
      <ul className="flex flex-wrap gap-2 md:grid md:grid-cols-[minmax(0,1fr)]">
        {EXAMPLES.map((example) => (
          <li key={example.id}>
            <button
              type="button"
              aria-pressed={selectedId === example.id}
              onClick={() => onPick(example)}
              className="flex h-11 items-center rounded-full border border-ink/12 px-4 text-left transition-[border-color,box-shadow,background-color] duration-100 ease-brand hover:border-ink hover:shadow-card aria-pressed:border-ink aria-pressed:bg-white md:grid md:h-auto md:w-full md:gap-1 md:rounded-md md:py-3"
            >
              <span className="text-[15px] leading-[1.3] font-medium">{example.title}</span>
              <span
                lang="cop"
                aria-hidden="true"
                className="hidden min-w-0 truncate font-coptic text-[17px] leading-[1.4] text-ink/60 md:block"
              >
                {example.coptic.split("\n")[0]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
