import { afterEach, describe, expect, it, vi } from "vitest";
import { saveIdealUserEdit } from "./idealText";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

/* -------------------------------------------------------------------------- */
/*  The user-edit contract: whole-document PUT, honest supersede.             */
/*                                                                            */
/*  The behaviour under test that MATTERS: a 409 VERSION_SUPERSEDED is         */
/*  reported up, NOT retried against the server's current_version. The old     */
/*  retry re-sent pre-take words over the text a just-landed take assembled.   */
/* -------------------------------------------------------------------------- */

let calls: Array<{ url: string; body: unknown }> = [];

function mockFetch(...responses: Array<{ status: number; body?: unknown }>) {
  calls = [];
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
      const r = responses[Math.min(i++, responses.length - 1)];
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: async () => r.body ?? null,
      };
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saveIdealUserEdit", () => {
  it("PUTs the whole document with the version it was edited from", async () => {
    mockFetch({ status: 200, body: { saved: true, version: 4 } });
    const r = await saveIdealUserEdit("arc1", "the whole doc", 3);
    expect(r).toEqual({ ok: true, version: 4 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/ideal-text/user-edit");
    expect(calls[0].body).toEqual({ text: "the whole doc", version: 3 });
  });

  it("reports a supersede instead of RETRYING it over the new version", async () => {
    mockFetch({
      status: 409,
      body: { code: "VERSION_SUPERSEDED", current_version: 7 },
    });
    const r = await saveIdealUserEdit("arc1", "pre-take words", 6);
    expect(r).toEqual({ ok: false, reason: "superseded", currentVersion: 7 });
    // The whole point: exactly ONE request. A second PUT here would be the
    // stale edit landing on top of the take that just assembled.
    expect(calls).toHaveLength(1);
  });

  it("supersedes on a document-moved refusal and fails the save on any other", async () => {
    mockFetch({ status: 409, body: { code: "IDEAL_TEXT_PARTS_REFRESH_REQUIRED" } });
    expect(await saveIdealUserEdit("arc1", "words", 6)).toEqual({
      ok: false, reason: "superseded", currentVersion: null,
    });
    mockFetch({ status: 409, body: { code: "IDEAL_TEXT_PART_REQUIRES_UNLOCK" } });
    expect(await saveIdealUserEdit("arc1", "words", 6)).toEqual({
      ok: false, reason: "error",
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
