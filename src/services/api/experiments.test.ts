/*
STORY    A host's experiment session stays on this device until they
         export or delete it, and only when sample data is turned on.
OUTCOME
  O1  With no flag, the client does not use the on-device sample.
  O2  With NEXT_PUBLIC_EXPERIMENTS_MOCK=1, opening, saving, exporting,
      and deleting a session keep the stored takes consistent.
PROVES   O1 -> "the sample flag is off unless it is set to 1"
         O2 -> "the experiment store"
*/
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("the experiment store", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("the sample flag is off unless it is set to 1", async () => {
    delete process.env.NEXT_PUBLIC_EXPERIMENTS_MOCK;
    const mod = await import("@/services/api/experiments");
    expect(mod.EXPERIMENTS_USE_MOCKS).toBe(false);
  });

  it("keeps a take on this device when the sample flag is on", async () => {
    process.env.NEXT_PUBLIC_EXPERIMENTS_MOCK = "1";
    const mod = await import("@/services/api/experiments");
    const { readExperimentContext } = await import("@/lib/willab/experiments/contextStore");
    expect(mod.EXPERIMENTS_USE_MOCKS).toBe(true);
    mod.resetExperimentStore();
    const session = await mod.openSession({});
    const prompt = mod.promptSchema().prompts.find((item) => item.id === "c5");
    expect(prompt?.text.startsWith("Policz na głos")).toBe(true);
    const take = await mod.saveTake({
      sessionId: session!.id,
      prompt: prompt!,
      selfRating: { energy: "low", feeling: "tense" },
    });
    expect(take?.volunteer_id.startsWith("vol_")).toBe(true);
    expect(take?.tag).toBe("challenging");
    expect(take?.analysis).toBeNull();
    await mod.beginAnalysis(take!.id);
    expect(await mod.readAnalysis(take!.id)).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 800));
    const reading = await mod.readAnalysis(take!.id);
    expect(reading?.gate?.step).toBe("engagement");
    expect(reading?.summary.arousal.unlocked).toBe(false);
    expect(reading && "score_if_unlocked" in reading.summary.arousal).toBe(true);
    expect(mod.readTakes().map((item) => item.id)).toEqual([take!.id]);
    const csv = await mod.exportMine("csv", "self");
    expect(csv.ok).toBe(true);
    if (csv.ok) {
      expect(csv.body).toContain(take!.volunteer_id);
      expect(csv.body).toContain("c5");
      expect(csv.body).not.toContain("service_role");
    }
    const blocked = await mod.exportMine("json", "researcher");
    expect(blocked).toEqual({ ok: false, reason: "consent" });
    await mod.openSession({ sessionId: session!.id, researcher: true });
    const shared = await mod.exportMine("json", "researcher");
    expect(shared.ok).toBe(true);
    if (shared.ok) expect(shared.body).toContain(take!.id);
    await mod.deleteMine();
    expect(mod.readTakes()).toEqual([]);
    expect(readExperimentContext()).toBeNull();
  });
});
