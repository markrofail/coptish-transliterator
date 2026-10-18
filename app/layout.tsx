import type { Metadata } from "next";
import { Noto_Sans_Coptic } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const notoSansCoptic = Noto_Sans_Coptic({
  subsets: ["coptic"],
  weight: "400",
  variable: "--font-noto-sans-coptic",
});

export const metadata: Metadata = {
  title: "Coptic Transliterator",
  description:
    "Transliterate Bohairic Coptic into Latin letters, following Greco-Bohairic pronunciation.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={notoSansCoptic.variable}>
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
