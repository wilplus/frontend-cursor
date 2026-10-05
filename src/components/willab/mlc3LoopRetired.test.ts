import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/* THE MLC-3 SERVICE LOOP IS RETIRED ON THE SPEAKER'S SHEET (founder
 * 2026-09-30, L8; contract 66; audit ML-15, 2026-10-05).
 *
 * The backend answers 410 on every /v2/user/mlc3 path but the Confident
 * Moment bundle's correlation read. The Feedback sheet used to mount the
 * loop's client behind NEXT_PUBLIC_MLC3_SERVICE_UI_ENABLED and the
 * exercise_service_ui ring, so a speaker the ring reached got a question and
 * an exercise rung whose every call failed. These fences keep it gone. The
 * one remaining importer of the client is the bundle's exercise panel, a
 * separate surface whose future is the founder's decision. */

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) out.push(...sources(path));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

describe("the retired MLC-3 loop stays off the speaker's sheet", () => {
  it("removed the lane's files", () => {
    expect(existsSync(join(root, "src/components/willab/usePracticeFlow.ts"))).toBe(false);
    expect(existsSync(join(root, "src/components/willab/Mlc3FirstClientPractice.tsx"))).toBe(false);
  });

  it("the sheet, its ladder and its payload carry no service lane", () => {
    const modal = code(read("src/components/willab/DeckChunkModal.tsx"));
    for (const gone of ["usePracticeFlow", "Mlc3", "firstClientService", "service_exercise", "mlc3"]) {
      expect(modal).not.toContain(gone);
    }
    const steps = code(read("src/lib/willab/chunkSteps.ts"));
    expect(steps).not.toContain("service_exercise");
    expect(steps).not.toContain("canPractiseService");
    expect(code(read("src/services/api/idealText.ts"))).not.toContain("mlc3_service");
  });

  it("no source reads the retired build flag", () => {
    const readers = sources("src").filter((file) =>
      code(read(file)).includes("NEXT_PUBLIC_MLC3_SERVICE_UI_ENABLED"));
    expect(readers).toEqual([]);
  });

  it("only the bundle's exercise panel still imports the client", () => {
    const importers = sources("src")
      .filter((file) => read(file).includes("@/services/api/mlc3FirstClient"))
      .map((file) => relative(root, join(root, file)));
    expect(importers).toEqual(["src/components/willab/ConfidentMomentExercisePanel.tsx"]);
  });
});
