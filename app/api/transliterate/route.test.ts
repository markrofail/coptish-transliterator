import { beforeEach, describe, expect, it, vi } from "vitest";

const { transliterate } = vi.hoisted(() => ({ transliterate: vi.fn() }));
vi.mock("@/lib/gemini", () => ({ transliterate }));

import { maxDuration, POST } from "@/app/api/transliterate/route";

async function call(body: string) {
  const response = await POST(
    new Request("http://localhost/api/transliterate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );
  return { status: response.status, json: await response.json() };
}

beforeEach(() => {
  transliterate.mockReset();
});

describe("POST /api/transliterate", () => {
  it("declares a 60-second maximum duration", () => {
    expect(maxDuration).toBe(60);
  });

  it("returns the transliteration of the trimmed input", async () => {
    transliterate.mockResolvedValue({ ok: true, latin: "Amin" });
    expect(await call(JSON.stringify({ text: "  Ⲁⲙⲏⲛ  " }))).toEqual({
      status: 200,
      json: { latin: "Amin" },
    });
    expect(transliterate).toHaveBeenCalledWith("Ⲁⲙⲏⲛ");
  });

  it("rejects a body that isn't JSON or has no string text field", async () => {
    for (const body of ["not json", "null", "[]", "{}", JSON.stringify({ text: 42 })]) {
      const { status, json } = await call(body);
      expect(status, body).toBe(400);
      expect(json.error.code, body).toBe("invalid_input");
    }
    expect(transliterate).not.toHaveBeenCalled();
  });

  it("passes validation messages through as invalid_input", async () => {
    const { status, json } = await call(JSON.stringify({ text: "Pikhristos" }));
    expect(status).toBe(400);
    expect(json).toEqual({
      error: { code: "invalid_input", message: expect.stringMatching(/unicode coptic/i) },
    });
    expect(transliterate).not.toHaveBeenCalled();
  });

  it("maps rate_limited to 429", async () => {
    transliterate.mockResolvedValue({ ok: false, code: "rate_limited" });
    const { status, json } = await call(JSON.stringify({ text: "Ⲁⲙⲏⲛ" }));
    expect(status).toBe(429);
    expect(json.error.code).toBe("rate_limited");
  });

  it("maps upstream to 502", async () => {
    transliterate.mockResolvedValue({ ok: false, code: "upstream" });
    const { status, json } = await call(JSON.stringify({ text: "Ⲁⲙⲏⲛ" }));
    expect(status).toBe(502);
    expect(json.error.code).toBe("upstream");
  });
});
