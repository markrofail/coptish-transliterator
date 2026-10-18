import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

// Stand-ins for Anthropic Sans and Anthropic Mono, which aren't publicly licensed.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken-grotesk",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

// Unicode Coptic font with no Latin glyphs, so it is applied to Coptic text only.
const csAvaVeni = localFont({
  src: "./fonts/CSAvaVeni-Regular.ttf",
  variable: "--font-cs-ava-veni",
});

export const metadata: Metadata = {
  title: "Coptic Transliterator",
  description:
    "Transliterate Bohairic Coptic into Latin letters, following Greco-Bohairic pronunciation.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${hankenGrotesk.variable} ${jetBrainsMono.variable} ${csAvaVeni.variable}`}
    >
      <body className="bg-paper font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
