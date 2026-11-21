import { describe, expect, it } from "vitest";
import { loadPromptFile } from "./promptsYaml";
import { pickInterventions } from "./overlap";
import { sampleAnalysis, seedInterventions } from "./sample";
import promptText from "./prompts_v1.yaml?raw";
import { leaksHiddenWord } from "./words";

const file = loadPromptFile(promptText);

describe("intervention overlap", () => {
  it("fires at most two, and the earliest step in the file's order wins", () => {
    const analysis = sampleAnalysis("take-1", file);
    expect(analysis.summary.gate).toBe(file.order[0]);
    const pick = pickInterventions(analysis.moments[0], seedInterventions(file), file.order, "take-1");
    expect(pick.shown.map((hit) => hit.id).sort()).toEqual(["short-pause", "slow-open"]);
    expect(pick.shown[0].overlap).toBeGreaterThanOrEqual(pick.shown[1].overlap);
    expect(pick.shown.every((hit) => hit.step === file.order[0])).toBe(true);
    expect(pick.hits.map((hit) => hit.id)).toContain("point-page");
    expect(pick.shown.map((hit) => hit.id)).not.toContain("point-page");
    expect(leaksHiddenWord(pick.shown.map((hit) => hit.name).join(" "))).toBeNull();
  });

  it("a later step can show when nothing earlier is strong enough", () => {
    const analysis = sampleAnalysis("take-2", file);
    const onlyLater = seedInterventions(file).filter((item) => item.id === "point-page");
    const pick = pickInterventions(analysis.moments[0], onlyLater, file.order, "take-2");
    expect(pick.shown).toHaveLength(1);
    expect(pick.shown[0].step).toBe(file.order[file.order.length - 1]);
  });
});
