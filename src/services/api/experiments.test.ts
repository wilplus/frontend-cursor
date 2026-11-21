/*
STORY    A host's experiment session stays on this device until they
         export or delete it.
OUTCOME
  O1  Opening, saving, exporting, and deleting a session keep the
      stored takes consistent.
PROVES   O1 -> "the experiment store"
*/
import { describe, expect, it, beforeEach } from "vitest";
import {
  beginAnalysis,
  deleteMine,
  EXPERIMENTS_USE_MOCKS,
  exportMine,
  openSession,
  promptSchema,
  readAnalysis,
  readTakes,
  resetExperimentStore,
  saveTake,
} from "@/services/api/experiments";
import { readExperimentContext } from "@/lib/willab/experiments/contextStore";

describe("the experiment store", () => {
  beforeEach(() => {
    resetExperimentStore();
  });

  it("stays on the mock and keeps a take under an anonymous id", async () => {
    expect(EXPERIMENTS_USE_MOCKS).toBe(true);
    const session = await openSession({});
    const prompt = promptSchema().prompts.find((item) => item.id === "c5");
    expect(prompt?.text.startsWith("Policz na głos")).toBe(true);
    const take = await saveTake({
      sessionId: session!.id,
      prompt: prompt!,
      selfRating: { energy: "low", feeling: "tense" },
    });
    expect(take?.volunteer_id.startsWith("vol_")).toBe(true);
    expect(take?.tag).toBe("challenging");
    expect(take?.analysis).toBeNull();
    await beginAnalysis(take!.id);
    expect(await readAnalysis(take!.id)).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 800));
    const reading = await readAnalysis(take!.id);
    expect(reading?.gate?.step).toBe("engagement");
    expect(reading?.summary.arousal.unlocked).toBe(false);
    expect(reading && "score_if_unlocked" in reading.summary.arousal).toBe(true);
    expect(readTakes().map((item) => item.id)).toEqual([take!.id]);
    const csv = await exportMine("csv", "self");
    expect(csv.ok).toBe(true);
    if (csv.ok) {
      expect(csv.body).toContain(take!.volunteer_id);
      expect(csv.body).toContain("c5");
      expect(csv.body).not.toContain("service_role");
    }
    const blocked = await exportMine("json", "researcher");
    expect(blocked).toEqual({ ok: false, reason: "consent" });
    await openSession({ sessionId: session!.id, researcher: true });
    const shared = await exportMine("json", "researcher");
    expect(shared.ok).toBe(true);
    if (shared.ok) expect(shared.body).toContain(take!.id);
    await deleteMine();
    expect(readTakes()).toEqual([]);
    expect(readExperimentContext()).toBeNull();
  });
});
