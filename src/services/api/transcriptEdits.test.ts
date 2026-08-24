import { afterEach, describe, expect, it, vi } from "vitest";
import { saveTranscriptEdit } from "./transcriptEdits";

let authToken: string | null = "tok";
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => authToken,
}));

let lastBody: string | null = null;
let lastHeaders: HeadersInit | undefined;
function mockFetch(ok: boolean, status = ok ? 200 : 500) {
  lastBody = null;
  lastHeaders = undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      lastBody = init.body as string;
      lastHeaders = init.headers;
      return { ok, status };
    })
  );
}

afterEach(() => {
  authToken = "tok";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saveTranscriptEdit", () => {
  it("sends snippet_id for a snippet target", async () => {
    mockFetch(true);
    const r = await saveTranscriptEdit("s1", { snippetId: "snip9" }, "new text");
    expect(r.ok).toBe(true);
    expect(JSON.parse(lastBody!)).toEqual({ snippet_id: "snip9", text: "new text" });
  });

  it("sends chunk_index for a deckless chunk target", async () => {
    mockFetch(true);
    const r = await saveTranscriptEdit("s1", { chunkIndex: 2 }, "chunk text");
    expect(r.ok).toBe(true);
    expect(JSON.parse(lastBody!)).toEqual({ chunk_index: 2, text: "chunk text" });
  });

  it("uses the signed Guest ID instead of a bare session id", async () => {
    authToken = null;
    vi.stubGlobal("localStorage", {
      getItem: () => "principal.secret-value-that-is-long-enough",
    });
    mockFetch(true);
    await saveTranscriptEdit("s1", { snippetId: "snip9" }, "new text");
    expect(lastHeaders).toEqual(
      expect.objectContaining({
        "X-Willab-Guest-Owner":
          "principal.secret-value-that-is-long-enough",
      })
    );
  });

  it("soft-fails on a non-ok response", async () => {
    mockFetch(false, 404);
    const r = await saveTranscriptEdit("s1", { snippetId: "x" }, "t");
    expect(r.ok).toBe(false);
  });

  it("soft-fails on a network throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );
    const r = await saveTranscriptEdit("s1", { chunkIndex: 0 }, "t");
    expect(r.ok).toBe(false);
  });
});
