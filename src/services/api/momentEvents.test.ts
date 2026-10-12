import { afterEach, describe, expect, it, vi } from "vitest";

import { reportMomentEvent } from "./momentEvents";

/* -------------------------------------------------------------------------- */
/*  A MOMENT OPENS BEFORE IT IS JUDGED — the receipt (founder 2026-10-01, F1; */
/*  Phase 2 of the after-practice paths; backend migration 0408)              */
/*                                                                            */
/*  Pins: the call names the moment, the event and what was on screen; the   */
/*  outcome tells recorded from ignored and carries what the sheet may show  */
/*  next; nothing throws; the BFF route goes through callBackend.            */
/* -------------------------------------------------------------------------- */

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "token" }));

describe("reportMomentEvent", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tells an already recorded event from a failure, and never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ recorded: false }),
      }),
    );
    expect(await reportMomentEvent("snip-1", "skipped")).toEqual({
      kind: "ignored",
      followUp: "none",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await reportMomentEvent("snip-1", "opened")).toEqual({ kind: "failed" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await reportMomentEvent("snip-1", "opened")).toEqual({ kind: "failed" });
  });

});
