"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { REPO_URL } from "@/app/repo";
import logo from "@/public/coptish-logo.png";

const LINK =
  "inline-flex h-11 items-center rounded-sm px-3 text-[15px] font-medium transition-[background-color] duration-100 ease-brand hover:bg-ink/6";

export function SiteNav() {
  // A client component only so the About link can show it's the current page.
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="mx-auto flex h-[60px] max-w-[1080px] items-center justify-between px-4 md:h-16 md:px-8"
    >
      <Link href="/" className="flex h-11 items-center gap-3.5 rounded-sm">
        <Image src={logo} alt="Coptish" priority className="h-9 w-auto md:h-10" />
        <span aria-hidden="true" className="h-[22px] w-px bg-ink/12" />
        <span className="font-mono text-[12px] leading-[1.4] text-ink/60">Transliterator</span>
      </Link>
      <div className="flex items-center gap-1">
        <Link
          href="/about"
          aria-current={pathname === "/about" ? "page" : undefined}
          className={`${LINK} aria-[current=page]:underline aria-[current=page]:decoration-[1.5px] aria-[current=page]:underline-offset-[6px]`}
        >
          About
        </Link>
        {/* On a phone the About page carries the GitHub link, so the bar stays uncluttered. */}
        <a href={REPO_URL} target="_blank" rel="noreferrer" className={`${LINK} max-md:hidden`}>
          GitHub<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </nav>
  );
}
