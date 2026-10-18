import type { Reading } from "@/lib/readings";

export const RATE_LIMITED_MESSAGE = "Too many requests, try again shortly.";
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export type ClientResult =
  | { ok: true; latin: string }
  | { ok: false; aborted: false; message: string; retryable: boolean }
  | { ok: false; aborted: true };

const ABORTED: ClientResult = { ok: false, aborted: true };

function failure(message: string, retryable: boolean): ClientResult {
  return { ok: false, aborted: false, message, retryable };
}

export async function requestTransliteration(
  text: string,
  reading: Reading,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ClientResult> {
  let response: Response;
  try {
    response = await fetchImpl("/api/transliterate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, reading }),
      signal,
    });
  } catch {
    return signal?.aborted ? ABORTED : failure(GENERIC_ERROR_MESSAGE, true);
  }
  if (signal?.aborted) return ABORTED;
  if (response.status === 429) {
    return failure(RATE_LIMITED_MESSAGE, true);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return signal?.aborted ? ABORTED : failure(GENERIC_ERROR_MESSAGE, true);
  }
  if (signal?.aborted) return ABORTED;
  if (response.ok && isRecord(body) && typeof body.latin === "string") {
    return { ok: true, latin: body.latin };
  }
  if (
    isRecord(body) &&
    isRecord(body.error) &&
    body.error.code === "invalid_input" &&
    typeof body.error.message === "string"
  ) {
    return failure(body.error.message, false);
  }
  return failure(GENERIC_ERROR_MESSAGE, true);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
