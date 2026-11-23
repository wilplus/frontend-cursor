/*
STORY    The experiment prompts file is the one the screens read.
OUTCOME
  O1  The file on disk matches the parsed order, lists, and words.
PROVES   O1 -> "reads the real file"
*/
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cellFor, comparisonFor } from "./grid";
import { checkPromptFile, loadPromptFile, PromptFileError } from "./promptsYaml";
import type { PromptFile } from "./types";
import promptText from "./prompts_v1.yaml?raw";

const file = loadPromptFile(promptText);

describe("prompts_v1.yaml", () => {
  it("reads the real file: order, scoring lists, Polish lines, and the self-rating words", () => {
    const onDisk = readFileSync(new URL("./prompts_v1.yaml", import.meta.url), "utf8");
    expect(loadPromptFile(onDisk).prompts.map((prompt) => prompt.id)).toEqual(file.prompts.map((prompt) => prompt.id));
    expect(file.version).toBe(1);
    expect(file.language).toBe("pl");
    expect(file.order).toEqual(["engagement", "arousal", "valence", "clarity"]);
    expect(file.baseline_scored).toEqual(["engagement", "arousal", "valence_voice"]);
    expect(file.reference_scored).toEqual(["valence_words", "clarity"]);
    expect(file.self_report).toEqual({ energy: ["low", "high"], feeling: ["good", "tense"] });
    expect(file.prompts.map((prompt) => prompt.id)).toEqual(["b1", "b2", "b3", "p1", "p2", "p3", "p4", "c1", "c2", "c3", "c4", "c5", "k1", "k2"]);
    expect(file.prompts.find((prompt) => prompt.id === "c5")).toMatchObject({
      tag: "challenging",
      text: "Policz na głos w pamięci od 1022 w dół co 13, jak najszybciej.",
    });
    expect(file.prompts.find((prompt) => prompt.id === "k1")?.reference).toBe("business_case");
    expect(file.prompts.find((prompt) => prompt.id === "b1")?.reference).toBeUndefined();
  });

  it("tags each cell from the file's lists, not from a fixed map", () => {
    expect(cellFor("valence", "vocal", 0.2, file).reference).toBe("baseline");
    expect(cellFor("valence", "verbal", -0.2, file).reference).toBe("reference");
    expect(cellFor("clarity", "verbal", 0.1, file).reference).toBe("reference");
    const flipped: PromptFile = {
      ...file,
      baseline_scored: ["clarity", "valence_voice"],
      reference_scored: ["engagement", "arousal", "valence_words"],
    };
    expect(checkPromptFile(flipped)).toEqual([]);
    expect(cellFor("engagement", "vocal", 0.4, flipped).reference).toBe("reference");
    expect(cellFor("clarity", "verbal", 0.4, flipped).reference).toBe("baseline");
  });

  it("refuses a file that drops a required field or adds one", () => {
    expect(() => loadPromptFile("version: 1\nlanguage: pl\n")).toThrow(PromptFileError);
    const extra = { ...file, notes: "no" };
    expect(checkPromptFile(extra).join(" ")).toContain("Unexpected field notes");
    expect(checkPromptFile({ ...file, self_report: { energy: ["low"], feeling: ["good", "tense"] } }).join(" ")).toContain("two words");
  });
});
