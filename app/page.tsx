import { Transliterator } from "@/app/transliterator";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-1 text-2xl font-semibold">Coptic Transliterator</h1>
      <p className="mb-6 text-gray-600">
        Paste Bohairic Coptic to read it in Latin letters, following Greco-Bohairic pronunciation.
      </p>
      <Transliterator />
    </main>
  );
}
