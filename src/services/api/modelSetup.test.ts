/*
STORY    As someone starting a model, I want "Start your own" to stay hidden
         until the backend has the setup and gives me the ring, and each
         step's answer to come back as the next step or as its reason in
         words, so I never meet a setup that cannot work (backend N528 item
         4, N566 item 2).
OUTCOME
  O1  Below the ring (404) or on any failure the setup reads as null, so its
      way in stays hidden.
  O2  A step answered gives the next step's screen; a step refused gives the
      backend's reason, to show under it.
PROVES   O1 -> "reads a 404 and a failure as null"
         O2 -> "returns the next step, or the reason a step was refused"
WHY      The client for routes/v2/model_setup.py (backend), behind ring 6.
*/
import { describe, expect, it, vi } from "vitest";

const bff = vi.fn();
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch: (...a: unknown[]) => bff(...a) }));

import { beginSetup, getInviteLink, getSetup, saveSetupStep } from "./modelSetup";

const kind = {
  model_id: "m1",
  status: "draft",
  screen: { step: "kind", caption: "Shape · 1 of 11", lines: ["From your answers, your model will do three things. Untick what it should not do."] },
};

describe("starting a model", () => {
  it("reads a 404 and a failure as null", async () => {
    bff.mockResolvedValueOnce({ kind: "response", ok: false, status: 404, body: { code: "NOT_FOUND" } });
    expect(await beginSetup()).toBeNull();
    bff.mockRejectedValueOnce(new Error("offline"));
    expect(await getSetup("m1")).toBeNull();
    bff.mockResolvedValueOnce({ kind: "response", ok: false, status: 404, body: null });
    expect(await getInviteLink("m1")).toBeNull();
  });

  it("returns the next step, or the reason a step was refused", async () => {
    bff.mockResolvedValueOnce({ kind: "response", ok: true, status: 200, body: kind });
    const next = await saveSetupStep("m1", "teach", { value: "I will rate short clips.", anyway: true });
    expect(next && "screen" in next ? next.screen.step : null).toBe("kind");
    expect(bff).toHaveBeenLastCalledWith("/api/v2/models/m1/setup/teach", expect.objectContaining({ method: "POST" }));
    bff.mockResolvedValueOnce({ kind: "response", ok: false, status: 400, body: { code: "EMPTY", error: "Write a few words first." } });
    expect(await saveSetupStep("m1", "problem", { value: " " })).toEqual({ refused: "Write a few words first." });
  });
});
