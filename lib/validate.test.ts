import { describe, expect, it } from "vitest";
import { MAX_INPUT_LENGTH, validateInput } from "@/lib/validate";

const COPTIC_LETTER = "ⲁ"; // U+2C81

describe("validateInput", () => {
  it("accepts Coptic text and returns it trimmed", () => {
    expect(validateInput("  Ⲁⲙⲏⲛ \n")).toEqual({ ok: true, text: "Ⲁⲙⲏⲛ" });
  });

  it("rejects empty and whitespace-only input", () => {
    for (const raw of ["", "   ", "\n\t"]) {
      const result = validateInput(raw);
      expect(result.ok, JSON.stringify(raw)).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/enter some coptic/i);
    }
  });

  it("accepts exactly 1,000 code points and rejects 1,001", () => {
    expect(validateInput(COPTIC_LETTER.repeat(MAX_INPUT_LENGTH)).ok).toBe(true);
    const tooLong = validateInput(COPTIC_LETTER.repeat(MAX_INPUT_LENGTH + 1));
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.message).toContain("1001");
  });

  it("measures length after trimming", () => {
    expect(validateInput(`  ${COPTIC_LETTER.repeat(MAX_INPUT_LENGTH)}  `).ok).toBe(true);
  });

  it("counts combining marks such as the jinkim as characters", () => {
    const withJinkim = "ⲛ̀"; // ⲛ̀ is two code points
    expect(validateInput(withJinkim.repeat(500)).ok).toBe(true);
    expect(validateInput(withJinkim.repeat(500) + COPTIC_LETTER).ok).toBe(false);
  });

  it("accepts the Coptic block boundaries and the Coptic letters in the Greek block", () => {
    for (const ch of ["Ⲁ", "⳿", "Ϣ", "ϯ", "ϯ", "ϣ"]) {
      expect(validateInput(ch).ok, ch).toBe(true);
    }
  });

  it("rejects text with no Coptic-specific letter", () => {
    for (const raw of ["πχριστος", "Pikhristos aftonf", "12 34", "ⴀ", "ϡ", "ϰ"]) {
      const result = validateInput(raw);
      expect(result.ok, raw).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/unicode coptic/i);
    }
  });

  // Review Focus 3
  it("accepts Windows line endings and the other jinkim marks", () => {
    expect(validateInput("Ⲡⲓⲭ̅ⲣⲓⲥⲧⲟⲥ\r\nϦⲉⲛ ⲟⲩⲙⲉⲑⲙⲏⲓ̿\r\n")).toEqual({
      ok: true,
      text: "Ⲡⲓⲭ̅ⲣⲓⲥⲧⲟⲥ\r\nϦⲉⲛ ⲟⲩⲙⲉⲑⲙⲏⲓ̿",
    });
  });

  // Review Focus 4
  it("accepts Coptic mixed with digits and English", () => {
    expect(validateInput("1 Ⲁⲙⲏⲛ (Amen)").ok).toBe(true);
  });
});
