import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workspace = readFileSync(
  "src/components/ceo/CeoWorkspace.tsx",
  "utf8"
);

describe("CEO surface navigation", () => {
  it("changes surfaces only through explicit clicks, never touch swipes", () => {
    expect(workspace).not.toMatch(
      /onTouch(?:Start|Move|End)|TouchEvent|beginSwipe|endSwipe/
    );
    expect(workspace).toContain(
      "onClick={() => updateState({ surface })}"
    );
  });
});
