import { describe, expect, it, vi } from "vitest";
import {
  GENERIC_ERROR_MESSAGE,
  RATE_LIMITED_MESSAGE,
  requestTransliteration,
} from "@/app/request-transliteration";

function respondWith(response: Response) {
  return vi.fn<typeof fetch>().mockResolvedValue(response);
}

describe("requestTransliteration", () => {
  it("posts the text as JSON and returns the transliteration", async () => {
    const fetchImpl = respondWith(Response.json({ latin: "Amin" }));
    await expect(requestTransliteration("Ⲁⲙⲏⲛ", 1, fetchImpl)).resolves.toEqual({
      ok: true,
      latin: "Amin",
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/transliterate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Ⲁⲙⲏⲛ", reading: 1 }),
    });
  });

  it("sends the reading number", async () => {
    const fetchImpl = respondWith(Response.json({ latin: "Amin" }));
    await requestTransliteration("Ⲁⲙⲏⲛ", 2, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith("/api/transliterate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Ⲁⲙⲏⲛ", reading: 2 }),
    });
  });

  it("shows the server's message for invalid input", async () => {
    const message = "Enter some Coptic text to transliterate.";
    const fetchImpl = respondWith(
      Response.json({ error: { code: "invalid_input", message } }, { status: 400 }),
    );
    await expect(requestTransliteration(" ", 1, fetchImpl)).resolves.toEqual({
      ok: false,
      aborted: false,
      message,
      retryable: false,
    });
  });

  it("shows the rate-limit message for any 429", async () => {
    for (const response of [
      Response.json({ error: { code: "rate_limited", message: "x" } }, { status: 429 }),
      new Response("Too Many Requests", { status: 429 }),
    ]) {
      await expect(requestTransliteration("Ⲁⲙⲏⲛ", 1, respondWith(response))).resolves.toEqual({
        ok: false,
        aborted: false,
        message: RATE_LIMITED_MESSAGE,
        retryable: true,
      });
    }
  });

  it("shows the generic message for upstream errors", async () => {
    const fetchImpl = respondWith(
      Response.json({ error: { code: "upstream", message: "unavailable" } }, { status: 502 }),
    );
    await expect(requestTransliteration("Ⲁⲙⲏⲛ", 1, fetchImpl)).resolves.toEqual({
      ok: false,
      aborted: false,
      message: GENERIC_ERROR_MESSAGE,
      retryable: true,
    });
  });

  // Review Focus 2
  it("shows the generic message for a non-JSON reply or a network failure", async () => {
    const htmlTimeout = respondWith(
      new Response("<html>504 Gateway Timeout</html>", {
        status: 504,
        headers: { "content-type": "text/html" },
      }),
    );
    await expect(requestTransliteration("Ⲁⲙⲏⲛ", 1, htmlTimeout)).resolves.toEqual({
      ok: false,
      aborted: false,
      message: GENERIC_ERROR_MESSAGE,
      retryable: true,
    });
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(requestTransliteration("Ⲁⲙⲏⲛ", 1, offline)).resolves.toEqual({
      ok: false,
      aborted: false,
      message: GENERIC_ERROR_MESSAGE,
      retryable: true,
    });
  });

  it("shows the generic message for a 200 without a latin string", async () => {
    await expect(requestTransliteration("Ⲁⲙⲏⲛ", 1, respondWith(Response.json({})))).resolves.toEqual({
      ok: false,
      aborted: false,
      message: GENERIC_ERROR_MESSAGE,
      retryable: true,
    });
  });

  it("passes the abort signal to fetch", async () => {
    const fetchImpl = respondWith(Response.json({ latin: "Amin" }));
    const { signal } = new AbortController();
    await requestTransliteration("Ⲁⲙⲏⲛ", 1, fetchImpl, signal);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/transliterate",
      expect.objectContaining({ signal }),
    );
  });

  it("reports a cancelled request as aborted, not as an error", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("Aborted", "AbortError"));
    await expect(requestTransliteration("Ⲁⲙⲏⲛ", 1, fetchImpl, controller.signal)).resolves.toEqual({
      ok: false,
      aborted: true,
    });
  });

  // Review Focus 1
  it("reports a reply that arrives after cancelling as aborted", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      controller.abort();
      return Response.json({ latin: "Amin" });
    });
    await expect(requestTransliteration("Ⲁⲙⲏⲛ", 1, fetchImpl, controller.signal)).resolves.toEqual({
      ok: false,
      aborted: true,
    });
  });
});
