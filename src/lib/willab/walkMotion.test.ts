import { describe, expect, it } from "vitest";
import { moveFor, type WalkScreen } from "./walkMotion";

/* The locked prototype's animate() (founder lock 2026-10-06, "How screens
   move"), one case per rule. The rendered walk tests prove the overlay
   rising (open), sliding on (next), cross-fading onto "Judgement time!" and
   the checking screen (fade) and sinking (close); what is left here are the
   rules no rendered test reaches. */

const s = (key: string, over: Partial<WalkScreen> = {}): WalkScreen => ({ key, ...over });
const page = s("page", { overlay: false });

describe("moveFor", () => {

  it("a tick or a word on the same screen does not move (nothing blinks)", () => {
    const helpers = s("helpers", { moment: 2 });
    expect(moveFor(helpers, { ...helpers })).toBe("none");
  });
});
