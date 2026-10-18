import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { buildPrompt } from "@/lib/prompt";
import type { Reading } from "@/lib/readings";

export const MODEL = "gemini-3.5-flash-lite";

export type GeminiConfig = { model: string; thinkingLevel: ThinkingLevel; temperature: number };

// gemini-3.8-flash scored better but its free tier allows only 20 requests a day per project.
// Low thinking beat minimal on the held-out pairs (63% exact / 98.5% chars against 63% / 97.7%).
// Readings 2 and 3 are sampled so the reader has something to choose between.
export const SAMPLED_TEMPERATURE = 1;

export const READINGS: Record<Reading, GeminiConfig> = {
  1: { model: MODEL, thinkingLevel: ThinkingLevel.LOW, temperature: 0 },
  2: { model: MODEL, thinkingLevel: ThinkingLevel.LOW, temperature: SAMPLED_TEMPERATURE },
  3: { model: MODEL, thinkingLevel: ThinkingLevel.LOW, temperature: SAMPLED_TEMPERATURE },
};

export const DEFAULT_CONFIG = READINGS[1];

const RESPONSE_SCHEMA = {
  type: "object",
  properties: { latin: { type: "string" } },
  required: ["latin"],
};

export type TransliterationResult =
  | { ok: true; latin: string }
  | { ok: false; code: "rate_limited" | "upstream" };

export function maxOutputTokens(text: string): number {
  return Math.min(8192, 64 + 2 * [...text].length);
}

export async function transliterate(
  text: string,
  config: GeminiConfig = DEFAULT_CONFIG,
  reading?: Reading,
): Promise<TransliterationResult> {
  const started = Date.now();
  const result = await callGemini(text, config);
  // Logs never include the input or output text.
  console.info(
    JSON.stringify({
      event: "transliterate",
      code: result.ok ? "ok" : result.code,
      ms: Date.now() - started,
      inputLength: [...text].length,
      model: config.model,
      temperature: config.temperature,
      reading: reading ?? null,
    }),
  );
  return result;
}

async function callGemini(text: string, config: GeminiConfig): Promise<TransliterationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set");
    return { ok: false, code: "upstream" };
  }
  const { systemInstruction, contents } = buildPrompt(text);
  try {
    const response = await new GoogleGenAI({ apiKey }).models.generateContent({
      model: config.model,
      contents,
      config: {
        systemInstruction,
        temperature: config.temperature,
        maxOutputTokens: maxOutputTokens(text),
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingLevel: config.thinkingLevel },
      },
    });
    const latin = parseLatin(response.text);
    return latin === undefined ? { ok: false, code: "upstream" } : { ok: true, latin };
  } catch (error) {
    const status = statusOf(error);
    console.error(JSON.stringify({ event: "gemini_error", status: status ?? null }));
    return { ok: false, code: status === 429 ? "rate_limited" : "upstream" };
  }
}

function parseLatin(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && "latin" in parsed && typeof parsed.latin === "string") {
      const latin = parsed.latin.trim();
      return latin === "" ? undefined : latin;
    }
  } catch {
    // Not JSON: handled the same as a missing answer.
  }
  return undefined;
}

function statusOf(error: unknown): unknown {
  return typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
}