import { afterEach, describe, expect, it, vi } from "vitest";
import { saveTranscriptEdit } from "./transcriptEdits";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

let lastBody: string | null = null;
function mockFetch(ok: boolean, status = ok ? 200 : 500) {
  lastBody = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      lastBody = init.body as string;
      return { ok, status };
    })
  );
}

afterEach(() => {
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
