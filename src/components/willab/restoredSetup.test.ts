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
  it("asks when nothing was restored", () => {
    // The ordinary race: the arc-setup fetch has not come back yet. Falling
    // back to the form is the whole reason this returns null rather than
    // recording against a half-known project.
    expect(restoredSetupFor(null, false)).toBeNull();
  });

  it("asks when a file is staged for upload", () => {
    // A staged upload carries no topic, and supplying one IS the form's job.
    expect(restoredSetupFor(FULL, true)).toBeNull();
  });

  it("asks when the restored project has no usable topic", () => {
    expect(restoredSetupFor({ ...FULL, topic: "" }, false)).toBeNull();
    expect(restoredSetupFor({ ...FULL, topic: "   " }, false)).toBeNull();
  });

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

  it("keeps a SERVED deck's slide count aligned to the PDF", () => {
    // clampSlides, not nonEmptySlides: slide N must stay slide N, so an empty
    // row in the middle of a served deck is kept rather than closing the gap
    // and shifting every slide after it off its page.
    const ctx = restoredSetupFor(FULL, false);
    expect(ctx!.slides).toHaveLength(FULL.slides.length);
  });

  it("drops the empty rows of a MANUAL deck", () => {
    const ctx = restoredSetupFor({ ...FULL, presentationRef: null }, false);
    expect(ctx!.slides).toEqual([{ title: "One", body: "first" }]);
  });

  it("treats a project with no deck and no length as complete", () => {
    // Topic is the only thing that is genuinely required. A project recorded
    // deckless and untimed is a real project, and sending its owner back
    // through the form to re-answer "no" and "no" is the interruption this
    // whole change exists to remove.
    const ctx = restoredSetupFor(
      {
        topic: "Just talking",
        presentationRef: null,
        slides: [],
        audience: null,
        targetLengthSeconds: null,
      },
      false
    );
    expect(ctx).not.toBeNull();
    expect(ctx!.slides).toEqual([]);
    expect(ctx!.target_length_seconds).toBeNull();
    expect(ctx!.audience).toBe("");
  });
});
