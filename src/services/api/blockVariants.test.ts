import { afterEach, describe, expect, it, vi } from "vitest";
import {
  restoreIdealTextRevision,
} from "./blockVariants";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

/* -------------------------------------------------------------------------- */
/*  BLOCK_VARIANTS — the picker contract (BE handoff 2026-08-03).              */
/*                                                                            */
/*  The behaviours that MATTER:                                                */
/*   · 404 is "feature off", a first-class state — never an error.             */
/*   · Served order is preserved verbatim (chronology, not ranking — AC-9).    */
/*   · A null variant_id survives ONLY as the display-only current entry.      */
/*   · Block rows are NEVER dropped (the paragraph zip is positional; a        */
/*     dropped row would misattribute every later block's picker).             */
/*   · select/restore map 404→gone and 409→stale for the silent refetch.       */
/* -------------------------------------------------------------------------- */

let calls: Array<{ url: string; method: string; body: unknown }> = [];

function mockFetch(...responses: Array<{ status: number; body?: unknown }>) {
  calls = [];
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(init.body as string) : null,
      });
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

describe("restoreIdealTextRevision", () => {
  it("POSTs the restore and returns the NEW head (restore is history too)", async () => {
    mockFetch({ status: 200, body: { restored: true, head_revision: 5 } });
    const r = await restoreIdealTextRevision("arc1", 1);
    expect(r).toEqual({ kind: "ok", headRevision: 5 });
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toContain("/ideal-text/revisions/1/restore");
  });
});
