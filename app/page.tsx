import { Transliterator } from "@/app/transliterator";

export default function Home() {
  return (
    <main className="mx-auto max-w-[1080px] px-4 pt-8 pb-[120px] md:px-8 md:pt-[44px] md:pb-[140px]">
      <header className="mb-[22px] md:mb-[58px]">
        <h1 className="mb-4 text-[length:clamp(40px,9vw,58px)] leading-[1.1] font-bold tracking-[-0.02em] text-balance md:text-[58px]">
          Read Coptic aloud.
        </h1>
        <p className="max-w-[44ch] text-[17px] leading-normal text-pretty text-ink/60 md:text-[18px]">
          Paste Bohairic Coptic and get it back in Latin letters, spelled the way it’s said in church.
        </p>
      </header>
      <Transliterator />
    </main>
  );
}
