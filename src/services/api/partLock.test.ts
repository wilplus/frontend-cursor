import { afterEach, describe, expect, it, vi } from "vitest";
import { setPartLock, setPartRootPhrase } from "./partLock";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

/* -------------------------------------------------------------------------- */
/*  partLock — the lock PUT's wire contract.                                   */
/*                                                                            */
/*  The piece that MATTERS: seed-on-lock (SPEC-lockin-loop §2). The founder's  */
/*  DoD locks a paragraph the student never manually edited, and an unedited   */
/*  document has no server-stored identity — without the seed riding this      */
/*  request, that flow could only ever 409 STALE.                              */
/* -------------------------------------------------------------------------- */

let calls: Array<{ url: string; body: Record<string, unknown> }> = [];

function mockFetch(status: number, body?: unknown) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({
        url,
        body: init?.body
          ? (JSON.parse(init.body as string) as Record<string, unknown>)
          : {},
      });
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body ?? null,
      };
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("setPartLock", () => {
  it("PUTs the lock with the words the student was looking at", async () => {
    mockFetch(200, { locked: true, part_id: "p1" });
    const r = await setPartLock("arc1", "p1", true, "The doc.");
    expect(r).toEqual({
      kind: "ok",
      locked: true,
      rootPhraseProposal: null,
    });
    expect(calls[0].url).toContain("/parts/p1/lock");
    expect(calls[0].body).toEqual({ locked: true, text_echo: "The doc." });
  });

  it("rides the seed as id+text ONLY — no lock flags inside the list", async () => {
    // A locked flag inside the seed would ask the server to lock paragraphs
    // the R3 gate never checked. The server ignores such flags; the client
    // never sends them, so there is nothing to ignore.
    mockFetch(200, { locked: true, part_id: "p1" });
    await setPartLock("arc1", "p1", true, "One.\n\nTwo.", {
      seedParts: [
        { id: "p1", text: "One.", locked: true } as unknown as {
          id: string;
          text: string;
        },
        { id: "p2", text: "Two." },
      ],
    });
    expect(calls[0].body.parts).toEqual([
      { id: "p1", text: "One." },
      { id: "p2", text: "Two." },
    ]);
  });

  it("omits the parts key entirely when there is no seed", async () => {
    // Present-and-empty and absent mean different things to the BE's parts
    // handling everywhere else; this endpoint gets the same discipline.
    mockFetch(200, { locked: true, part_id: "p1" });
    await setPartLock("arc1", "p1", true, "Doc.", { seedParts: [] });
    expect(calls[0].body).not.toHaveProperty("parts");
    await setPartLock("arc1", "p1", true, "Doc.");
    expect(calls[1].body).not.toHaveProperty("parts");
  });

  it("maps the exact rooting-phrase proposal and records keep-evolving", async () => {
    mockFetch(200, {
      root_phrase_proposal: { text: "exact words", start: 4, end: 15 },
    });
    const result = await setPartLock("a", "p", false, "The exact words.", {
      reason: "keep_evolving",
    });
    expect(result).toEqual({
      kind: "ok",
      locked: false,
      rootPhraseProposal: { text: "exact words", start: 4, end: 15 },
    });
    expect(calls[0].body.reason).toBe("keep_evolving");
  });

  it("stores or explicitly skips an exact orange phrase", async () => {
    mockFetch(200);
    expect(await setPartRootPhrase(
      "a", "p", "The exact words.", { text: "exact words", start: 4, end: 15 },
    )).toBe(true);
    expect(calls[0].body).toEqual({
      text_echo: "The exact words.",
      phrase: "exact words",
      start: 4,
      end: 15,
    });
    await setPartRootPhrase("a", "p", "The exact words.", null);
    expect(calls[1].body).toEqual({
      text_echo: "The exact words.",
      phrase: null,
      start: null,
      end: null,
    });
  });

  it("discriminates UNDECIDED from STALE on the same 409", async () => {
    mockFetch(409, { code: "UNDECIDED", pending: 2 });
    expect(await setPartLock("a", "p", true, "d")).toEqual({
      kind: "undecided",
    });
    mockFetch(409, { code: "STALE_DOCUMENT" });
    expect(await setPartLock("a", "p", true, "d")).toEqual({ kind: "stale" });
  });

  it("soft-fails a 500 and a network throw", async () => {
    mockFetch(500);
    expect(await setPartLock("a", "p", true, "d")).toEqual({ kind: "error" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );
    expect(await setPartLock("a", "p", true, "d")).toEqual({ kind: "error" });
  });
});
