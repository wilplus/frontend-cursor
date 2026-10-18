import { describe, expect, it } from "vitest";
import {
  DEFAULT_DECK,
  deckForRecording,
} from "./defaultDeck";

describe("deckForRecording — the substitution rule", () => {
  const own = [{ title: "Our numbers", body: "Q3 revenue." }];

  it("a deckless speaker records against the default — the F1 point: buckets always exist", () => {
    for (const empty of [null, undefined, []]) {
      const r = deckForRecording(empty);
      expect(r.isDefault).toBe(true);
      expect(r.slides).toEqual(DEFAULT_DECK);
    }
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
