import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateContent, constructed } = vi.hoisted(() => ({
  generateContent: vi.fn(),
  constructed: [] as unknown[],
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
    constructor(options: unknown) {
      constructed.push(options);
    }
  },
  ThinkingLevel: { MINIMAL: "MINIMAL", LOW: "LOW" },
}));

import { ThinkingLevel } from "@google/genai";
import { DEFAULT_CONFIG, MODEL, maxOutputTokens, transliterate } from "@/lib/gemini";
import { SYSTEM_INSTRUCTION } from "@/lib/prompt";

function apiError(status: number) {
  return Object.assign(new Error(`status ${status}`), { status });
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  generateContent.mockReset();
  constructed.length = 0;
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("transliterate", () => {
  it("returns the latin field from Gemini's JSON reply", async () => {
    generateContent.mockResolvedValue({ text: '{"latin":"Amin"}' });
    await expect(transliterate("Ⲁⲙⲏⲛ")).resolves.toEqual({ ok: true, latin: "Amin" });
  });

  it("sends the key, model, prompt and generation settings", async () => {
    generateContent.mockResolvedValue({ text: '{"latin":"Amin"}' });
    await transliterate("Ⲁⲙⲏⲛ");
    expect(constructed).toEqual([{ apiKey: "test-key" }]);
    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe(MODEL);
    expect(MODEL).toBe("gemini-3.5-flash-lite");
    expect(request.contents.at(-1)).toEqual({
      role: "user",
      parts: [{ text: "<coptic>\nⲀⲙⲏⲛ\n</coptic>" }],
    });
    expect(request.config).toEqual({
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0,
      maxOutputTokens: maxOutputTokens("Ⲁⲙⲏⲛ"),
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        properties: { latin: { type: "string" } },
        required: ["latin"],
      },
      thinkingConfig: { thinkingLevel: "LOW" },
    });
  });

  it("defaults to the production model and low thinking", () => {
    expect(DEFAULT_CONFIG).toEqual({ model: MODEL, thinkingLevel: "LOW" });
  });

  it("uses a custom model and thinking level when given, and logs that model", async () => {
    generateContent.mockResolvedValue({ text: '{"latin":"Amin"}' });
    await transliterate("Ⲁⲙⲏⲛ", { model: "gemini-test-flash", thinkingLevel: ThinkingLevel.LOW });
    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe("gemini-test-flash");
    expect(request.config.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
    expect(String(vi.mocked(console.info).mock.calls[0][0])).toContain('"model":"gemini-test-flash"');
  });

  it("maps a 429 from Gemini to rate_limited", async () => {
    generateContent.mockRejectedValue(apiError(429));
    await expect(transliterate("Ⲁⲙⲏⲛ")).resolves.toEqual({ ok: false, code: "rate_limited" });
  });

  it("maps other API errors and anything else thrown to upstream", async () => {
    for (const error of [apiError(500), apiError(400), new TypeError("fetch failed"), "boom"]) {
      generateContent.mockRejectedValueOnce(error);
      await expect(transliterate("Ⲁⲙⲏⲛ"), String(error)).resolves.toEqual({
        ok: false,
        code: "upstream",
      });
    }
  });

  // Review Focus 1
  it("maps a missing, non-JSON, wrongly shaped or blank reply to upstream", async () => {
    for (const text of [undefined, "Amin", "{}", '{"latin":42}', '{"latin":"   "}', '{"latin":"Am']) {
      generateContent.mockResolvedValueOnce({ text });
      await expect(transliterate("Ⲁⲙⲏⲛ"), String(text)).resolves.toEqual({
        ok: false,
        code: "upstream",
      });
    }
  });

  it("trims whitespace around the transliteration and keeps inner line breaks", async () => {
    generateContent.mockResolvedValue({
      text: '{"latin":"  Pikhristos aftonf\\nKhen oumethmi aftonf \\n"}',
    });
    await expect(transliterate("Ⲡⲓⲭⲣⲓⲥⲧⲟⲥ ⲁϥⲧⲱⲛϥ\nϦⲉⲛ ⲟⲩⲙⲉⲑⲙⲏⲓ ⲁϥⲧⲱⲛϥ")).resolves.toEqual({
      ok: true,
      latin: "Pikhristos aftonf\nKhen oumethmi aftonf",
    });
  });

  it("returns upstream without calling Gemini when GEMINI_API_KEY is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(transliterate("Ⲁⲙⲏⲛ")).resolves.toEqual({ ok: false, code: "upstream" });
    expect(generateContent).not.toHaveBeenCalled();
  });

  // Review Focus 5
  it("never logs the input or output text", async () => {
    const input = "Ⲡⲓⲭⲣⲓⲥⲧⲟⲥ ⲁϥⲧⲱⲛϥ";
    generateContent.mockResolvedValueOnce({ text: '{"latin":"Pikhristos aftonf"}' });
    await transliterate(input);
    generateContent.mockRejectedValueOnce(apiError(500));
    await transliterate(input);
    const logged = [console.info, console.error]
      .flatMap((fn) => vi.mocked(fn).mock.calls)
      .map((args) => args.map(String).join(" "))
      .join("\n");
    expect(logged).not.toContain(input);
    expect(logged).not.toContain("Pikhristos");
    expect(logged).toContain(`"inputLength":${[...input].length}`);
  });
});

describe("maxOutputTokens", () => {
  it("is 64 plus twice the input length, capped at 2,048", () => {
    expect(maxOutputTokens("ⲁ")).toBe(66);
    expect(maxOutputTokens("ⲁ".repeat(991))).toBe(2046);
    expect(maxOutputTokens("ⲁ".repeat(992))).toBe(2048);
    expect(maxOutputTokens("ⲁ".repeat(1000))).toBe(2048);
  });
});