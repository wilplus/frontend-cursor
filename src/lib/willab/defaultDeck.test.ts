/*
STORY    As a speaker with no slides, I want to record against a default deck,
         so that my Take is still split into slide paragraphs.
OUTCOME
  O1  An empty, null or undefined deck gives the default deck, flagged
      isDefault. Never-3: record -> Ideal Text never breaks for lack of slides.
  O2  My own deck is used unchanged, flagged not default.
  O3  The default deck handed back by the project's setup for Take 2 is still
      the default deck; a served PDF is always my own presentation.
PROVES   O1 -> "a deckless speaker records against the default"
         O2 -> "a speaker's own deck is kept as it is"
         O3 -> "the stand-in deck handed back by the project's setup ..."
*/
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DECK,
  deckForRecording,
} from "./defaultDeck";

describe("deckForRecording — the substitution rule", () => {
  const own = [{ title: "Our numbers", body: "Q3 revenue." }];

  it("a deckless speaker records against the default", () => {
    expect(DEFAULT_DECK.length).toBeGreaterThan(0);
    for (const empty of [null, undefined, []]) {
      const r = deckForRecording(empty);
      expect(r.isDefault).toBe(true);
      expect(r.slides).toEqual(DEFAULT_DECK);
    }
  });

  it("a speaker's own deck is kept as it is", () => {
    const r = deckForRecording(own);
    expect(r.isDefault).toBe(false);
    expect(r.slides).toEqual(own);
  });

  it("the stand-in deck handed back by the project's setup is still the stand-in deck (founder 2026-10-16: Take 2 mirrors Take 1)", () => {
    // The saved setup returns a deckless Take 1's slides as bare rows, as
    // the backend stores them: trimmed, no artwork.
    const fromServer = DEFAULT_DECK.map((s) => ({ title: s.title, body: s.body.trim() }));
    const r = deckForRecording(fromServer, null);
    expect(r.isDefault).toBe(true);
    expect(r.slides).toEqual(DEFAULT_DECK);
    // The speaker's own typed slides stay their own.
    expect(deckForRecording(own, null)).toEqual({ slides: own, isDefault: false });
    // A served PDF is the speaker's presentation whatever its text says.
    expect(deckForRecording(fromServer, "https://example.test/deck.pdf").isDefault).toBe(false);
  });
});
