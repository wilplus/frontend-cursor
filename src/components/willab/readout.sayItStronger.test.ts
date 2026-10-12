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
