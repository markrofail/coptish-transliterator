export const RATE_LIMITED_MESSAGE = "Too many requests, try again shortly.";
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export type ClientResult = { ok: true; latin: string } | { ok: false; message: string };

export async function requestTransliteration(
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ClientResult> {
  let response: Response;
  try {
    response = await fetchImpl("/api/transliterate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }
  if (response.status === 429) {
    return { ok: false, message: RATE_LIMITED_MESSAGE };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }
  if (response.ok && isRecord(body) && typeof body.latin === "string") {
    return { ok: true, latin: body.latin };
  }
  if (
    isRecord(body) &&
    isRecord(body.error) &&
    body.error.code === "invalid_input" &&
    typeof body.error.message === "string"
  ) {
    return { ok: false, message: body.error.message };
  }
  return { ok: false, message: GENERIC_ERROR_MESSAGE };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
