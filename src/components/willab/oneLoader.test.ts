import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const WILLAB = join(ROOT, "src/components/willab");

const NINE = [
  "ConfidentMomentExercisePanel.tsx",
  "DeckChunkModal.tsx",
  "DeckCoachFeedback.tsx",
  "HelperWordsSheet.tsx",
  "IdealTextMenu.tsx",
  "ParagraphSheet.tsx",
  "PractiseSheet.tsx",
  "RaterLanguageGate.tsx",
];

function listTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsx(full));
    } else if (entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("one loader", () => {
  it("has no Loader2 in non-test willab components", () => {
    const offenders = listTsx(WILLAB).filter((file) => readFileSync(file, "utf8").includes("Loader2"));
    expect(offenders).toEqual([]);
  });

  it("uses the voice mark at the spinner footprint in the nine files", () => {
    for (const name of NINE) {
      const source = readFileSync(join(WILLAB, name), "utf8");
      expect(source).toContain("<VoiceMark size={1");
    }
  });

  it("stands still under reduced motion", () => {
    const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*\.breath-ring[\s\S]*animation:\s*none/);
  });

  it("keeps the two canonical 64px marks and the voice-mark attribute", () => {
    const source = readFileSync(join(WILLAB, "LoadingState.tsx"), "utf8");
    expect(source.match(/<VoiceMark size=\{64\}/g)).toHaveLength(2);
    expect(source).toContain("data-voice-mark");
  });
});
