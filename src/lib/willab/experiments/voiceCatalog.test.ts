/*
STORY    The voice-model catalog is whatever the route returns. A missing
         route is not a made-up list.
OUTCOME
  O1  A catalog body is accepted only when it is {models:[...]} in the
      draft shape.
  O2  Calm questions start from b1–b3 in the prompt file, and a locked
      step follows the unlocked flag, not a hidden score.
PROVES   O1 -> "rejects a catalog that is not the draft shape"
         O2 -> "calm questions come from the prompt file"
*/
import { describe, expect, it } from "vitest";
import type { AnalyzeTake } from "./types";
import { calmFromFile, classifyStatus, readCatalog, readConfig, readTips, stepLocked, type VoiceModel } from "./voiceCatalog";

const MODEL: VoiceModel = {
  id: "wpl_arousal@0.2",
  name: "Voice and words",
  measures: "How much you join in, how your voice moves, how it lands and how clear it was",
  language: "pl",
  source: "built_in",
  research_only: true,
  needs_baseline: true,
  steps: ["engagement", "arousal", "valence", "clarity"],
  version: "0.1",
  baseline_prompt_ids: ["b1", "b2", "b3"],
  schema: "analyze-take/v0.1",
};

describe("the voice catalog", () => {
  it("rejects a catalog that is not the draft shape", () => {
    expect(readCatalog(null).state).toBe("not-on-yet");
    expect(readCatalog([MODEL]).state).toBe("not-on-yet");
    expect(readCatalog({ models: [{ name: "Arousal" }] }).state).toBe("not-on-yet");
    const ready = readCatalog({ models: [MODEL] });
    expect(ready.state).toBe("ready");
    if (ready.state === "ready") {
      expect(ready.models[0].name).toBe("Voice and words");
      expect(ready.models[0].research_only).toBe(true);
    }
  });

  it("calm questions come from the prompt file", () => {
    const calm = calmFromFile();
    expect(calm.map((row) => row.id)).toEqual(["b1", "b2", "b3"]);
    const config = readConfig({
      model_id: MODEL.id,
      needs_baseline: true,
      baseline_prompt_ids: ["b1", "b2"],
      baseline_prompts: calm.slice(0, 2),
    });
    expect(config.state).toBe("ready");
  });

  it("a locked step is not a score", () => {
    const take = {
      order: ["engagement", "arousal"],
      moments: [],
      summary: {
        engagement: { score: 0.1, confidence: 0.9, vs: "baseline", unlocked: true },
        arousal: { score: null, confidence: 0.2, vs: "baseline", unlocked: false, score_if_unlocked: 0.4 },
      },
      gate: { step: "arousal", reason: "confidence" },
    } as unknown as AnalyzeTake;
    expect(stepLocked(take, "engagement")).toBe(false);
    expect(stepLocked(take, "arousal")).toBe(true);
    expect(classifyStatus(403, { code: "NOT_HOST" })).toBe("host-only");
    expect(classifyStatus(404, {})).toBe("absent");
    expect(classifyStatus(403, { code: "RESEARCHER_CONSENT_REQUIRED" })).toBe("other");
    const tips = readTips({ intervention: [{ id: "i1", name: "Join in", text: "Say one more sentence.", step: "engagement", score: 2 }] });
    expect(tips.map((tip) => tip.text)).toEqual(["Say one more sentence."]);
    expect(readTips({ intervention: [] })).toEqual([]);
  });
});
