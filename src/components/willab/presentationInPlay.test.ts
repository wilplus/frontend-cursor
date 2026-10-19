import { describe, expect, it } from "vitest";
import { DEFAULT_DECK } from "@/lib/willab/defaultDeck";
import {
  PRESENTATION_IN_PLAY,
  laterTakePresentation,
  presentationInPlay,
} from "./presentationInPlay";

describe("which presentation a later Take is said against (founder 2026-10-16)", () => {
  it("names the speaker's own file, the stand-in deck, or nothing until the setup is known", () => {
    expect(
      presentationInPlay({ slides: [{ title: "", body: "" }], presentationRef: "https://example.test/deck.pdf" }),
    ).toBe(PRESENTATION_IN_PLAY.own);
    // A deckless Take 1, as the device caches it (no slides)…
    expect(presentationInPlay({ slides: [], presentationRef: null })).toBe(PRESENTATION_IN_PLAY.standIn);
    // …and as the project's saved setup hands it back (the stand-in's rows).
    const rows = DEFAULT_DECK.map((s) => ({ title: s.title, body: s.body }));
    expect(presentationInPlay({ slides: rows, presentationRef: null })).toBe(PRESENTATION_IN_PLAY.standIn);
    expect(presentationInPlay(null)).toBeNull();
  });

  it("is shown before a later Take only, from the Take's own setup first", () => {
    const own = { slides: [], presentationRef: "https://example.test/deck.pdf" };
    const standIn = { slides: [], presentationRef: null };
    expect(laterTakePresentation(1, own, own)).toBeNull();
    expect(laterTakePresentation(2, own, standIn)).toBe(PRESENTATION_IN_PLAY.own);
    expect(laterTakePresentation(2, null, standIn)).toBe(PRESENTATION_IN_PLAY.standIn);
    expect(laterTakePresentation(2, null, null)).toBeNull();
  });
});
