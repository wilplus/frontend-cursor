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
});
