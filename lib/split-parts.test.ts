import { describe, expect, it } from "vitest";
import { joinParts, splitParts } from "@/lib/split-parts";

const stanza = (i: number) =>
  `ⲁⲣⲓⲡ̀ⲣⲉⲥⲃⲉⲩⲓⲛ ⲉ̀ϩ̀ⲣⲏⲓ ⲉ̀ϫⲱⲛ:\nⲱ̀ ⲡⲉⲛϭⲟⲓⲥ ${i}:\nⲙⲁⲣⲓⲁ ⲑ̀ⲙⲁⲩ:\nⲛ̀ⲧⲉϥⲭⲁ ⲛⲉⲛⲛⲟⲃⲓ ⲛⲁⲛ ⲉ̀ⲃⲟⲗ.`;
const hymn = (n: number, gap = "\n\n") =>
  Array.from({ length: n }, (_, i) => stanza(i)).join(gap);
const len = (s: string) => [...s].length;

const inputs: Record<string, string> = {
  blank: hymn(106),
  line: hymn(106, "\n"),
  punct: hymn(106).replace(/\s+/g, " "),
  space: "ⲁⲃⲅ ".repeat(3000).trim(),
  crlf: hymn(106).replace(/\n/g, "\r\n"),
};

describe("splitParts", () => {
  it("keeps a paste of 4,000 as one part", () => {
    const text = "ⲁ ".repeat(2000).trim();
    expect(len(text)).toBe(3999);
    expect(splitParts(text)).toEqual([{ text, separator: "" }]);
    const longer = text + "ⲁⲁ";
    expect(len(longer)).toBe(4001);
    expect(splitParts(longer)).toHaveLength(2);
    const exact = text + "ⲁ";
    expect(len(exact)).toBe(4000);
    expect(splitParts(exact)).toHaveLength(1);
  });

  it("splits into balanced parts of at most 4,000", () => {
    const text = hymn(106);
    expect(len(text)).toBe(9004);
    const parts = splitParts(text);
    expect(parts).toHaveLength(3);
    for (const p of parts) {
      expect(len(p.text)).toBeLessThanOrEqual(4000);
      expect(len(p.text)).toBeGreaterThanOrEqual(2000);
    }
  });

  it("cuts at stanza breaks when there are any", () => {
    const parts = splitParts(hymn(106));
    for (const [i, p] of parts.entries()) {
      if (i > 0) expect(p.separator).toBe("\n\n");
      expect(p.text.endsWith("ⲉ̀ⲃⲟⲗ.")).toBe(true);
    }
  });

  it("cuts at a line break when there are no stanza breaks", () => {
    const parts = splitParts(hymn(106, "\n"));
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts.slice(1)) expect(p.separator).toBe("\n");
  });

  it("cuts after a colon or full stop when there are no line breaks", () => {
    const parts = splitParts(hymn(106).replace(/\s+/g, " "));
    expect(parts.length).toBeGreaterThan(1);
    for (const [i, p] of parts.entries()) {
      if (i > 0) expect(p.separator).toBe(" ");
      if (i < parts.length - 1) expect(/[:.]$/.test(p.text)).toBe(true);
    }
  });

  it("cuts at a space when there is no punctuation", () => {
    const parts = splitParts(inputs.space);
    expect(parts.length).toBeGreaterThan(1);
    for (const [i, p] of parts.entries()) {
      expect(len(p.text)).toBeLessThanOrEqual(4000);
      if (i > 0) expect(p.separator).toBe(" ");
      expect(p.text).toBe(p.text.trim());
    }
  });

  it("never cuts inside a word", () => {
    for (const [name, input] of Object.entries(inputs)) {
      const words = splitParts(input).flatMap((p) => p.text.split(/\s+/));
      expect(words, name).toEqual(input.split(/\s+/));
    }
  });

  it("hard-cuts a text with no spaces at 4,000", () => {
    const text = "ⲁ".repeat(9000);
    const parts = splitParts(text);
    expect(parts.map((p) => len(p.text))).toEqual([4000, 4000, 1000]);
    expect(parts.map((p) => p.separator)).toEqual(["", "", ""]);
    expect(parts.map((p) => p.text).join("")).toBe(text);
  });

  it("handles the 16,000 maximum", () => {
    const text = hymn(187);
    expect(len(text)).toBe(15970);
    const parts = splitParts(text);
    expect(parts.length).toBeGreaterThanOrEqual(4);
    expect(parts.length).toBeLessThanOrEqual(5);
    for (const p of parts) expect(len(p.text)).toBeLessThanOrEqual(4000);
  });

  it("splits the 16,000 maximum into 4 parts", () => {
    const parts = splitParts(hymn(187));
    expect(parts).toHaveLength(4);
    for (const p of parts) expect(len(p.text)).toBeLessThanOrEqual(4000);
  });

  it("prefers a near line break over a far stanza break", () => {
    const body = Array.from({ length: 300 }, (_, i) => stanza(i).replace(/\n/g, " ")).join("\n");
    const text = "ⲡⲓϩⲩⲙⲛⲟⲥ\n\n" + body;
    expect(len(text)).toBeGreaterThan(8000);
    const parts = splitParts(text);
    expect(len(parts[0].text)).toBeGreaterThanOrEqual(2000);
    expect(parts.length).toBeLessThanOrEqual(Math.ceil(len(text) / 4000));
    expect(joinParts(parts)).toBe(text);
  });

  it("does not cut off a short opening stanza as its own part", () => {
    const lines = Array.from({ length: 66 }, (_, i) => stanza(i).replace(/\n/g, " "));
    const text = lines.slice(0, 3).join("\n") + "\n\n" + lines.slice(3).join("\n");
    expect(len(text)).toBeGreaterThan(5000);
    expect(len(text)).toBeLessThanOrEqual(8000);
    expect(splitParts(text)).toHaveLength(2);
  });

  it("cuts at a middle dot", () => {
    const text = "ⲁⲃⲅ ⲇⲉ ⲉⲍ· ".repeat(400).trim();
    expect(len(text)).toBeGreaterThan(4000);
    const parts = splitParts(text);
    expect(parts.length).toBeGreaterThan(1);
    for (const [i, p] of parts.entries()) {
      if (i > 0) expect(p.separator).toBe(" ");
      if (i < parts.length - 1) expect(p.text.endsWith("·")).toBe(true);
    }
  });

  it("takes the cut closest to the target", () => {
    const text = hymn(150);
    const parts = splitParts(text);
    const total = len(text);
    const n = parts.length;
    let pos = 0;
    for (let i = 0; i < n - 1; i++) {
      pos += len(parts[i].text);
      const target = Math.round((i + 1) * (total / n));
      expect(Math.abs(pos - target)).toBeLessThanOrEqual(1000);
      pos += parts[i + 1].separator.length;
    }
  });

  it("treats \\r\\n line endings like \\n", () => {
    const parts = splitParts(inputs.crlf);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts.slice(1)) expect(p.separator).toBe("\n\n");
  });
});

describe("joinParts", () => {
  it("joins pieces with their parts' separators", () => {
    expect(
      joinParts([
        { separator: "", text: "a" },
        { separator: "\n\n", text: "b" },
        { separator: "\n", text: "c" },
        { separator: " ", text: "d" },
        { separator: "", text: "e" },
      ]),
    ).toBe("a\n\nb\nc de");
  });

  it("round-trips every input", () => {
    for (const [name, input] of Object.entries(inputs)) {
      const expected = input.replace(/\r\n/g, "\n");
      expect(joinParts(splitParts(input)), name).toBe(expected);
    }
  });
});
