import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LAB = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");

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
