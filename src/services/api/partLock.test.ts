/*
STORY    As a speaker, I want locking a paragraph to send the words I was
         looking at, and to tell "decide the pending suggestions first" apart
         from "your text is out of date", so that locking works even on a text
         I never edited and I get the right message.
OUTCOME
  O1  Locking sends the lock together with the words on my screen.
  O2  "Decide pending suggestions first" and "out of date" come back as two
      different answers.
PROVES   O1 -> "PUTs the lock with the words the student was looking at"
         O2 -> "discriminates UNDECIDED from STALE on the same 409"
*/
import { afterEach, describe, expect, it, vi } from "vitest";
import { setPartLock } from "./partLock";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

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

  it("discriminates UNDECIDED from STALE on the same 409", async () => {
    mockFetch(409, { code: "UNDECIDED", pending: 2 });
    expect(await setPartLock("a", "p", true, "d")).toEqual({
      kind: "undecided",
    });
    mockFetch(409, { code: "STALE_DOCUMENT" });
    expect(await setPartLock("a", "p", true, "d")).toEqual({ kind: "stale" });
  });
});
