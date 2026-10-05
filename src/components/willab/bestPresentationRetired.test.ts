/* Best Presentation is retired (L1; second plan, founder "go" 2026-10-05).
 * Its card no longer fires and the ones already written hide; every door
 * that opened its overlay (the card, the Library button, /chat?arc=) opens
 * the arc's Ideal Text instead, and the overlay is no longer mounted. */
import { existsSync, readFileSync } from "node:fs";
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

describe("the deck ref no longer reads Best Presentation", () => {
  // Its GET answers 410 since 2026-10-05 (N48.3 Q13 A): the builder sent the
  // speaker's words to a model with no permit. The project's setup read
  // carries the same deck ref.
  const hook = readFileSync(
    join(process.cwd(), "src/components/willab/useArcDeckRef.ts"),
    "utf8",
  );

  it("falls back to the project's setup read", () => {
    expect(hook).not.toContain("fetchBestPresentation");
    expect(hook).not.toContain("@/services/api/bestPresentation");
    expect(hook).toContain("fetchArcSetup(arcId)");
  });
});

describe("the Best Presentation client is gone (N48.3 Q13 A)", () => {
  it("removes the overlay, the API client and the BFF route", () => {
    for (const file of [
      "src/components/willab/BestPresentationOverlay.tsx",
      "src/services/api/bestPresentation.ts",
      "src/app/api/v2/explore/arc/[arcId]/best-presentation/route.ts",
    ]) {
      expect(existsSync(join(process.cwd(), file)), file).toBe(false);
    }
  });
});
