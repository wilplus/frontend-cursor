/*
STORY    As the founder, I want "a moment was opened or skipped" recorded
         without ever breaking the screen, so that we learn what speakers see
         while they are never blocked.
OUTCOME
  O1  An event the server already had is told apart from a failure.
  O2  A switched-off route or no connection is a quiet failure, never a
      crash.
PROVES   O1, O2 -> "tells an already recorded event from a failure, and never throws"
*/
import { afterEach, describe, expect, it, vi } from "vitest";

import { reportMomentEvent } from "./momentEvents";

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
