import { READINGS, transliterate } from "@/lib/gemini";
import { READING_NUMBERS } from "@/lib/readings";
import { validateInput } from "@/lib/validate";

// The longest Vercel lets this function run, in seconds.
export const maxDuration = 60;

type ErrorCode = "invalid_input" | "rate_limited" | "upstream";

function errorResponse(status: number, code: ErrorCode, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_input", "Send JSON with a text field.");
  }
  const fields = typeof body === "object" && body !== null ? body : {};
  const raw = "text" in fields ? fields.text : undefined;
  if (typeof raw !== "string") {
    return errorResponse(400, "invalid_input", "Send JSON with a text field.");
  }

  const requested = "reading" in fields ? fields.reading : 1;
  const reading = READING_NUMBERS.find((n) => n === requested);
  if (reading === undefined) {
    return errorResponse(400, "invalid_input", "reading must be 1, 2 or 3.");
  }

  const input = validateInput(raw);
  if (!input.ok) {
    return errorResponse(400, "invalid_input", input.message);
  }

  const result = await transliterate(input.text, READINGS[reading], reading);
  if (result.ok) {
    return Response.json({ latin: result.latin });
  }
  if (result.code === "rate_limited") {
    return errorResponse(429, "rate_limited", "Too many requests right now. Please try again shortly.");
  }
  return errorResponse(502, "upstream", "The transliteration service is unavailable. Please try again.");
}
