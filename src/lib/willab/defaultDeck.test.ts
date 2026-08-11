import { describe, expect, it } from "vitest";
import {
  DEFAULT_DECK,
  deckForRecording,
} from "./defaultDeck";

/* The default deck is founder copy (2026-08-11) AND an F1 guarantee: every
 * recording has slide buckets, so word→slide segmentation is always defined.
 * These pin both halves — the words, and the substitution rule. */

describe("DEFAULT_DECK — the founder's mock presentation", () => {
  it("is the three-part talk, in order", () => {
    expect(DEFAULT_DECK).toHaveLength(3);
    expect(DEFAULT_DECK.map((s) => s.title)).toEqual([
      "Intro — the hook + the promise.",
      "Body — one core message, 3 supporting points.",
      "Ending — recap + call to action.",
    ]);
  });

  it("carries the founder's rules verbatim — this copy is signed off, not paraphrasable", () => {
    expect(DEFAULT_DECK[0].body).toContain(
      "Rule: say what you're going to say."
    );
    expect(DEFAULT_DECK[1].body).toContain("Rule: say it — tell, show, prove.");
    expect(DEFAULT_DECK[2].body).toContain(
      "Rule: say what you said, and close with a clear ask."
    );
  });

  it("every slide has real words on both fields — a blank slide is a bucket nobody can speak to", () => {
    for (const s of DEFAULT_DECK) {
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(s.body.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("deckForRecording — the substitution rule", () => {
  const own = [{ title: "Our numbers", body: "Q3 revenue." }];

  it("a deckless speaker records against the default — the F1 point: buckets always exist", () => {
    for (const empty of [null, undefined, []]) {
      const r = deckForRecording(empty);
      expect(r.isDefault).toBe(true);
      expect(r.slides).toEqual(DEFAULT_DECK);
    }
  });

  it("a speaker's OWN deck is never replaced, and never padded to three", () => {
    const r = deckForRecording(own);
    expect(r.isDefault).toBe(false);
    expect(r.slides).toEqual(own);
    expect(r.slides).toHaveLength(1);
  });

  it("a deck of blank slides is not a deck — it would produce buckets with nothing to say", () => {
    const r = deckForRecording([{ title: "  ", body: "\n" }]);
    expect(r.isDefault).toBe(true);
  });

  it("keeps a slide that has only a title, or only a body — half a slide is still the speaker's", () => {
    expect(deckForRecording([{ title: "Just a title", body: "" }]).isDefault).toBe(
      false
    );
    expect(deckForRecording([{ title: "", body: "Just a body" }]).isDefault).toBe(
      false
    );
  });
});
