export const MAX_INPUT_LENGTH = 4000;

// Letters only Coptic uses: the Coptic block, plus the Coptic letters in the Greek block (Ϣ…ϯ).
const COPTIC_SPECIFIC = /[Ⲁ-⳿Ϣ-ϯ]/u;

export type InputCheck = { ok: true; text: string } | { ok: false; message: string };

export function validateInput(raw: string): InputCheck {
  const text = raw.trim();
  if (text === "") {
    return { ok: false, message: "Enter some Coptic text to transliterate." };
  }
  const length = [...text].length;
  if (length > MAX_INPUT_LENGTH) {
    return {
      ok: false,
      message: `That's ${length} characters. The limit is ${MAX_INPUT_LENGTH}, so try a shorter passage.`,
    };
  }
  if (!COPTIC_SPECIFIC.test(text)) {
    return {
      ok: false,
      message:
        "This doesn't look like Unicode Coptic. Paste text written in Coptic letters, such as ⲁ, ϣ or ϯ.",
    };
  }
  return { ok: true, text };
}
