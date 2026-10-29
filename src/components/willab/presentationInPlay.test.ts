/*
STORY    As a speaker starting a later Take, I want to be told whether I am
         speaking to my own slides or the stand-in deck, so that I know what
         this Take goes with.
OUTCOME
  O1  It names my own file, the stand-in deck, or nothing while the setup
      is not known yet.
  O2  It is shown only before Take 2 and later, from that Take's own setup
      first, then the project's.
  O3  On the first Take after I changed the slides it says "New slides";
      after that it names the Take the slides were first used on.
PROVES   O1 -> "names the speaker's own file, the stand-in deck, or nothing until the setup is known"
         O2 -> "is shown before a later Take only, from the Take's own setup first"
         O3 -> "says New slides on the first Take with them, then the Take they started on"
WHY      Founder 2026-10-16; backend N257 (2026-10-29).
*/
import { describe, expect, it } from "vitest";
import { DEFAULT_DECK } from "@/lib/willab/defaultDeck";
import {
  PRESENTATION_IN_PLAY,
  deckNewsOf,
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

  it("says New slides on the first Take with them, then the Take they started on", () => {
    const own = { slides: [{ title: "Hook", body: "" }], presentationRef: "https://example.test/v2.pdf" };
    // The project's setup read (N257): the deck changed since the last Take…
    expect(laterTakePresentation(5, null, own, deckNewsOf({ deckChanged: true, deckSinceTake: 5 }))).toBe("New slides");
    // …and from the next Take on, the Take the slides were first used on.
    expect(laterTakePresentation(6, null, own, deckNewsOf({ deckChanged: false, deckSinceTake: 5 }))).toBe(
      "Same presentation as Take 5",
    );
    // Not sent: today's line.
    expect(laterTakePresentation(2, null, own, deckNewsOf({}))).toBe(PRESENTATION_IN_PLAY.own);
  });
});
