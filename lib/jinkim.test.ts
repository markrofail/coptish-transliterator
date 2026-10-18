import { describe, expect, it } from "vitest";
import { expandJinkim } from "@/lib/jinkim";

describe("expandJinkim", () => {
  it("writes ⲉ before a consonant with a jinkim at the start of a word", () => {
    expect(expandJinkim("ⲛ̀ⲧⲉ ⲡ̀ϣⲏⲣⲓ")).toBe("ⲉⲛⲧⲉ ⲉⲡϣⲏⲣⲓ");
  });

  it("writes ⲉ before a consonant with a jinkim after another consonant", () => {
    expect(expandJinkim("ⲙ̀ⲫ̀ⲓⲱⲧ")).toBe("ⲉⲙⲉⲫⲓⲱⲧ");
  });

  it("only drops the jinkim when the letter before it is a vowel", () => {
    expect(expandJinkim("Ⲡⲓⲭ̀ⲣⲓⲥⲧⲟⲥ ⲉⲑⲣⲉⲛ̀ϩⲱⲥ")).toBe("Ⲡⲓⲭⲣⲓⲥⲧⲟⲥ ⲉⲑⲣⲉⲛϩⲱⲥ");
  });

  it("moves a word's capital onto the added ⲉ", () => {
    expect(expandJinkim("Ⲙ̀ⲫⲣⲏϯ")).toBe("Ⲉⲙⲫⲣⲏϯ");
  });

  it("leaves jinkims on vowels, overlines, punctuation and non-Coptic text unchanged", () => {
    const text = "ⲉ̀ⲃⲟⲗ Ⲡⲭ̅ⲥ̅:\nⲀⲙⲏⲛ. 12 n\u0300";
    expect(expandJinkim(text)).toBe(text);
  });
});
