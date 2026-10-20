/*
STORY    As a speaker, I want "why" and reason lines that the server removed
         to be left out, not shown blank, so that I never see empty or
         forbidden text.
OUTCOME
  O1  An empty "why" or reason becomes nothing to show.
PROVES   O1 -> "nulls why + reason when the BE output-guard stripped them (AC-9)"
WHY      Never 1; AC-9 (the backend guard strips score-like lines).
*/
import { describe, expect, it } from "vitest";
import {
  mapSayItStronger,
} from "./readout";

describe("mapSayItStronger", () => {

  it("nulls why + reason when the BE output-guard stripped them (AC-9)", () => {
    const s = mapSayItStronger({
      upgrades: [{ original: "a", upgrade: "b", reason: "" }],
      rewrite_your_voice: "x",
      rewrite_polished: "y",
      why: "",
    });
    expect(s!.why).toBeNull();
    expect(s!.upgrades[0]?.reason).toBeNull();
  });
});
