/* Best Presentation is retired (L1; second plan, founder "go" 2026-10-05).
 * Its card no longer fires and the ones already written hide; every door
 * that opened its overlay (the card, the Library button, /chat?arc=) opens
 * the arc's Ideal Text instead, and the overlay is no longer mounted. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lounge = readFileSync(
  join(process.cwd(), "src/components/willab/Lounge.tsx"),
  "utf8",
);

describe("Best Presentation leaves the Lounge", () => {
  it("no longer mounts the overlay", () => {
    expect(lounge).not.toContain("<BestPresentationOverlay");
    expect(lounge).not.toContain("setBestPresentationArcId");
  });

  it("opens the Ideal Text from every old door", () => {
    expect(lounge).toContain("openIdealText(initialBestPresentationArcId)");
    const doors = lounge.match(/onOpenBestPresentation=\{\(arcId\) =>\s*openIdealText\(arcId\)\s*\}/g);
    expect(doors?.length).toBe(2);
  });
});
