import { describe, expect, it } from "vitest";
import { leavesCopy, moveFor, walkSig, type WalkScreen } from "./walkMotion";

/* The locked prototype's animate() (founder lock 2026-10-06, "How screens
   move"), one case per rule. The rendered walk tests prove the overlay
   rising (open), sliding on (next), cross-fading onto "Judgement time!" and
   the checking screen (fade) and sinking (close); what is left here are the
   rules no rendered test reaches. */

const s = (key: string, over: Partial<WalkScreen> = {}): WalkScreen => ({ key, ...over });
const page = s("page", { overlay: false });

describe("moveFor", () => {
  it("the first screen does not move", () => {
    expect(moveFor(null, s("praise", { moment: 0 }))).toBe("none");
  });

  it("an explicit 'none' never moves", () => {
    expect(moveFor(s("praise", { moment: 0 }), s("clearer", { moment: 1 }), "none")).toBe("none");
  });

  it("a tick or a word on the same screen does not move (nothing blinks)", () => {
    const helpers = s("helpers", { moment: 2 });
    expect(moveFor(helpers, { ...helpers })).toBe("none");
  });

  it("another try of the practise loop is another screen", () => {
    expect(walkSig(s("practise", { moment: 1, attempt: 0 }))).not.toBe(
      walkSig(s("practise", { moment: 1, attempt: 1 })),
    );
  });

  it("an explicit direction moves even on the same screen", () => {
    const praise = s("praise", { moment: 0 });
    expect(moveFor(praise, praise, "back")).toBe("back");
  });

  it("page to page is not the walk's to move", () => {
    expect(moveFor(page, s("end", { overlay: false }))).toBe("none");
  });

  it("arriving at a result from anywhere but the checking screen is an ordinary next", () => {
    expect(moveFor(s("clearer", { moment: 1 }), s("encourage", { moment: 1 }))).toBe("next");
  });
});

describe("leavesCopy", () => {
  it("a move with an out-animation keeps the leaving screen; open does not", () => {
    expect(leavesCopy("next")).toBe(true);
    expect(leavesCopy("open")).toBe(false);
  });
});
