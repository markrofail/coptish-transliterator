"use client";

import { useState, type FormEvent } from "react";
import { requestTransliteration } from "@/app/request-transliteration";

export function Transliterator() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = inputText.trim() === "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading || isEmpty) return;
    setIsLoading(true);
    setError(null);
    setOutputText("");
    const result = await requestTransliteration(inputText);
    if (result.ok) {
      setOutputText(result.latin);
    } else if (!result.aborted) {
      setError(result.message);
    }
    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="coptic" className="font-medium">
        Coptic text
      </label>
      <textarea
        id="coptic"
        lang="cop"
        rows={6}
        value={inputText}
        onChange={(event) => setInputText(event.target.value)}
        placeholder="Ⲡⲓⲭⲣⲓⲥⲧⲟⲥ ⲁϥⲧⲱⲛϥ"
        className="font-coptic w-full rounded-md border border-gray-300 p-3 text-xl"
      />
      <button
        type="submit"
        disabled={isLoading || isEmpty}
        className="self-start rounded-md bg-blue-700 px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Transliterating…" : "Transliterate"}
      </button>
      {error && <p className="text-red-700">{error}</p>}
      <label htmlFor="latin" className="mt-3 font-medium">
        Latin transliteration
      </label>
      <textarea
        id="latin"
        rows={6}
        readOnly
        value={outputText}
        className={`w-full rounded-md border border-gray-300 bg-gray-50 p-3 text-xl ${isLoading ? "opacity-50" : ""}`}
      />
    </form>
  );
}
