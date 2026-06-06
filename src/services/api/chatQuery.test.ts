import { afterEach, describe, expect, it, vi } from "vitest";
import { postChatQuery } from "./chatQuery";

function mockFetch(res: { ok: boolean; status: number; body?: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        ({
          ok: res.ok,
          status: res.status,
          json: async () => res.body ?? {},
        }) as unknown as Response
    )
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("postChatQuery (JSON path)", () => {
  it("returns the parsed body on a 200", async () => {
    mockFetch({ ok: true, status: 200, body: { answer: "Speak slower." } });
    const r = await postChatQuery({ question: "how?", history: [] });
    expect(r.answer).toBe("Speak slower.");
  });

  it("throws on a non-2xx so the caller surfaces a reach-failure, not a blank answer", async () => {
    mockFetch({ ok: false, status: 500, body: { error: "boom" } });
    await expect(
      postChatQuery({ question: "how?", history: [] })
    ).rejects.toThrow();
  });
});
