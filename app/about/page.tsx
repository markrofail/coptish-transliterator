import type { Metadata } from "next";
import { REPO_NAME, REPO_URL } from "@/app/repo";

export const metadata: Metadata = {
  title: "About · Coptish",
  description: "Coptish is a project to make Coptic more accessible.",
};

export default function About() {
  return (
    <main className="mx-auto max-w-[1080px] px-4 pt-8 pb-[120px] md:px-8 md:pt-[44px] md:pb-[140px]">
      <h1 className="mb-[22px] max-w-[760px] text-[length:clamp(40px,9vw,58px)] leading-[1.1] font-bold tracking-[-0.02em] text-balance md:text-[58px]">
        Our Coptic heritage, made accessible.
      </h1>
      <p className="mb-4 max-w-[52ch] text-[17px] leading-[1.55] text-pretty md:text-[18px]">
        Coptish is a project to make Coptic more accessible, so anyone in church can read along, pray
        along and learn.
      </p>
      <p className="mb-4 max-w-[52ch] text-[17px] leading-[1.55] text-pretty text-ink/60 md:text-[18px]">
        This transliterator is one part of it. More tools are on the way.
      </p>
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex h-11 items-center gap-2.5 rounded-sm border border-ink px-4 text-[15px] font-medium transition-[background-color,transform] duration-100 ease-brand hover:bg-ink/6 active:scale-[0.98]"
      >
        View the code on GitHub
        <span className="font-mono text-[12px] leading-none text-ink/60 max-md:hidden">{REPO_NAME}</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </main>
  );
}
