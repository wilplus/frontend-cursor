import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/*  THE RECORDING SCREEN                                                       */
/*                                                                            */
/*  A source scan, because this screen is difficult to open without a live mic.*/
/*  The non-cosmetic invariant is that every scroll-selected slide still       */
/*  reaches the overlay's canonical setter. Those changes are timestamped into */
/*  the timeline the backend uses for word-to-slide bucketing.                 */
/* -------------------------------------------------------------------------- */

const LAB = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");

const PHASE = LAB.slice(LAB.indexOf("export function RecordingPhase"));

describe("the recording screen", () => {

  it("keeps the numberless duration bar", () => {
    const strip = PHASE.slice(
      PHASE.indexOf("const strip"),
      PHASE.indexOf("if (!hasDeck)")
    );
    expect(strip).toMatch(/aria-hidden/);
    expect(strip).not.toMatch(/%<|toFixed|Math\.round/);
  });

});

describe("guest Project ownership at the processing boundary", () => {
  it("replaces an unprovable cached guest Project before uploading", () => {
    expect(LAB).toContain(
      "signedIn === false && projectId && !uploadGuestOwnerToken",
    );
    expect(LAB).toContain("clearExploreArc(null)");
    expect(LAB).toContain("recordedTakeRef.current = 1");
    expect(LAB).toContain("guestOwnerToken: uploadGuestOwnerToken");
  });
});
