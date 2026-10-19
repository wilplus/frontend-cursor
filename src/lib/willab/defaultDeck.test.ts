/*
STORY    As a speaker with no slides, I want to record against a default deck,
         so that my Take is still split into slide paragraphs.
OUTCOME
  O1  An empty, null or undefined deck gives the default deck, flagged
      isDefault. Never-3: record -> Ideal Text never breaks for lack of slides.
  O2  My own deck is used unchanged, flagged not default.
PROVES   O1 -> "a deckless speaker records against the default"
         O2 -> "a speaker's own deck is kept as it is"
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
});
