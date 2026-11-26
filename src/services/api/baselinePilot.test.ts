/*
STORY    The baseline stores felt energy and valence in separate writes.
OUTCOME
  O1  Each report sends only the speaker's current choice and retain the exact source step.
PROVES   O1 -> "private baseline energy reports"
*/
import { beforeEach, describe, expect, it, vi } from "vitest";
const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch: send }));
import { baselinePilot, privateBaselinePilot } from "./baselinePilot";

describe("private baseline energy reports", () => {
  beforeEach(() => { send.mockReset(); });
  it("sends an unsure felt-energy answer without valence or an inferred label", async () => {
    send.mockResolvedValue({ kind: "response", ok: true, body: { entry_allowed: false, run: {
      id: "run", mode: "initial", protocol_version: "test", created_at: "now", completed_at: null,
      next_step: { id: "bright", prompt: "Another real context", state: "record" },
    } } });
    await baselinePilot.report("run", "quiet", { felt_energy: "unsure" });
    expect(send).toHaveBeenCalledWith("/api/dev/baseline-pilot/runs/run/steps/quiet/report", expect.objectContaining({
      method: "PUT", json: { felt_energy: "unsure" }, auth: "optional", cache: "no-store",
    }));
  });
  it("starts a Polish run and writes only its current valence", async () => {
    send.mockResolvedValue({ kind: "response", ok: true, body: { entry_allowed: false, run: {
      id: "run", mode: "initial", protocol_version: "test", created_at: "now", completed_at: null,
      next_step: { id: "quiet", prompt: "Opowiedz o swojej rutynie.", state: "record" },
    } } });
    await privateBaselinePilot.start("polish-v1", "request", "pl");
    expect(send).toHaveBeenLastCalledWith("/api/v2/experiments/baseline-pilot/runs", expect.objectContaining({
      method: "POST", json: { mode: "initial", request_id: "request", language: "pl",
        consent: { participant: true, researcher: false, version: "polish-v1" } },
    }));
    await privateBaselinePilot.report("run", "quiet", { felt_valence: "mixed" });
    expect(send).toHaveBeenLastCalledWith("/api/v2/experiments/baseline-pilot/runs/run/steps/quiet/report",
      expect.objectContaining({ method: "PUT", json: { felt_valence: "mixed" }, cache: "no-store" }));
    expect(send.mock.lastCall?.[1]).not.toHaveProperty("auth");
  });

  it.each([[401, "signed-out"], [404, "denied"]])("distinguishes HTTP %s from a retryable error", async (status, kind) => {
    send.mockResolvedValue({ kind: "response", ok: false, status, body: {} });
    await expect(privateBaselinePilot.status("en")).rejects.toMatchObject({ kind });
  });

});
