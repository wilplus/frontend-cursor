import { describe, expect, it } from "vitest";
import { restoredSetupFor } from "./restoredSetup";
import { type ExploreArcDeck } from "@/lib/willab/exploreArc";

/**
 * Skipping the recording setup form.
 *
 * What is pinned here is the FALLBACK, not the happy path. Returning a context
 * sends the user straight to a live mic, and whatever this function said is
 * what the take gets filed under — project, deck, clock. A take is not
 * something a user can quietly redo, so every case short of a fully restored
 * project must return null and let the form ask.
 */

const FULL: ExploreArcDeck = {
  topic: "Knowledge pill #7",
  audience: "the leadership team",
  presentationRef: "https://example.test/deck.pdf",
  slides: [
    { title: "One", body: "first" },
    { title: "", body: "" },
  ],
  targetLengthSeconds: 180,
};

describe("restoredSetupFor", () => {

  it("carries the whole restored setup through, trimmed", () => {
    const ctx = restoredSetupFor({ ...FULL, topic: "  Knowledge pill #7 " }, false);
    expect(ctx).not.toBeNull();
    expect(ctx!.topic).toBe("Knowledge pill #7");
    expect(ctx!.audience).toBe("the leadership team");
    // R5 — the set length is what makes take 2+ keep its countdown instead of
    // silently reverting to a stopwatch.
    expect(ctx!.target_length_seconds).toBe(180);
    expect(ctx!.presentationRef).toBe("https://example.test/deck.pdf");
  });
});
