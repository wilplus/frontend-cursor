import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchIdealText, saveIdealUserEdit } from "./idealText";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

/* -------------------------------------------------------------------------- */
/*  T1 · 1.2 — the user-edit contract: whole-document PUT, honest supersede.   */
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

  it("omits `reapplied` unless the caller asked for it", async () => {
    mockFetch({ status: 200, body: { version: 1 } });
    await saveIdealUserEdit("arc1", "doc", 1);
    expect(calls[0].body).not.toHaveProperty("reapplied");
  });

  it("sends `reapplied: true` ONLY on the re-apply action", async () => {
    mockFetch({ status: 200, body: { version: 5 } });
    await saveIdealUserEdit("arc1", "my held version", 5, { reapplied: true });
    expect(calls[0].body).toEqual({
      text: "my held version",
      version: 5,
      reapplied: true,
    });
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

  it("survives a supersede body with no current_version", async () => {
    mockFetch({ status: 409, body: { code: "VERSION_SUPERSEDED" } });
    const r = await saveIdealUserEdit("arc1", "words", 2);
    expect(r).toEqual({ ok: false, reason: "superseded", currentVersion: null });
  });

  it("discriminates NOTHING_TO_EDIT from a supersede on the same 409", async () => {
    mockFetch({ status: 409, body: { code: "NOTHING_TO_EDIT" } });
    const r = await saveIdealUserEdit("arc1", "words", null);
    expect(r).toEqual({ ok: false, reason: "nothingToEdit" });
  });

  it("maps 400 INVALID_INPUT to `invalid`", async () => {
    mockFetch({ status: 400, body: { code: "INVALID_INPUT" } });
    const r = await saveIdealUserEdit("arc1", "words", 1);
    expect(r).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses an over-long document locally, without a doomed round trip", async () => {
    mockFetch({ status: 200, body: { version: 1 } });
    const r = await saveIdealUserEdit("arc1", "x".repeat(20001), 1);
    expect(r).toEqual({ ok: false, reason: "invalid" });
    expect(calls).toHaveLength(0);
  });

  it("soft-fails a 500 and a network throw", async () => {
    mockFetch({ status: 500 });
    expect(await saveIdealUserEdit("arc1", "t", 1)).toEqual({
      ok: false,
      reason: "error",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );
    expect(await saveIdealUserEdit("arc1", "t", 1)).toEqual({
      ok: false,
      reason: "error",
    });
  });
});

describe("fetchIdealText — the T1 · 1.2 additive fields", () => {
  const base = {
    status: "unverified",
    text: "One part.\n\nAnother part.",
    version: 3,
  };

  it("feature-detects prior_edit when the BE ships it", async () => {
    mockFetch({
      status: 200,
      body: {
        ...base,
        user_edited: true,
        prior_edit: { text: "my superseded version", version: 2 },
        can_record_take: true,
      },
    });
    const r = await fetchIdealText("arc1");
    expect(r.kind).toBe("single");
    if (r.kind !== "single") return;
    expect(r.userEdited).toBe(true);
    expect(r.priorEdit).toEqual({ text: "my superseded version", version: 2 });
    expect(r.canRecordTake).toBe(true);
  });

  it("is null on today's payload (pending BE) — the FE falls back to its buffer", async () => {
    mockFetch({ status: 200, body: base });
    const r = await fetchIdealText("arc1");
    if (r.kind !== "single") throw new Error("expected single");
    expect(r.priorEdit).toBeNull();
    expect(r.canRecordTake).toBeNull();
    expect(r.userEdited).toBe(false);
  });

  it("ignores a malformed or wordless prior_edit rather than offering nothing", async () => {
    mockFetch({ status: 200, body: { ...base, prior_edit: { text: "  " } } });
    const r = await fetchIdealText("arc1");
    if (r.kind !== "single") throw new Error("expected single");
    expect(r.priorEdit).toBeNull();

    mockFetch({ status: 200, body: { ...base, prior_edit: "nope" } });
    const r2 = await fetchIdealText("arc1");
    if (r2.kind !== "single") throw new Error("expected single");
    expect(r2.priorEdit).toBeNull();
  });

  it("keeps can_record_take as a TRI-state: false gates, null never does", async () => {
    // The distinction the whole gate rests on. `false` is the only value that
    // may disable the record button; absent must stay indistinguishable from
    // "no opinion", or an older deploy would go dark on the record loop.
    mockFetch({ status: 200, body: { ...base, can_record_take: false } });
    const r = await fetchIdealText("arc1");
    if (r.kind !== "single") throw new Error("expected single");
    expect(r.canRecordTake).toBe(false);

    for (const body of [base, { ...base, can_record_take: null }, { ...base, can_record_take: "no" }]) {
      mockFetch({ status: 200, body });
      const rn = await fetchIdealText("arc1");
      if (rn.kind !== "single") throw new Error("expected single");
      expect(rn.canRecordTake).toBeNull();
    }
  });

  it("keeps a prior_edit whose version the BE omitted", async () => {
    mockFetch({
      status: 200,
      body: { ...base, prior_edit: { text: "held words" } },
    });
    const r = await fetchIdealText("arc1");
    if (r.kind !== "single") throw new Error("expected single");
    expect(r.priorEdit).toEqual({ text: "held words", version: null });
  });
});
