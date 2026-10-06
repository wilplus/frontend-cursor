import { describe, expect, it } from "vitest";
import {
  WALK_APART,
  WALK_SAME_MOMENT,
  leavesCopy,
  moveFor,
  walkSig,
  type WalkScreen,
} from "./walkMotion";

/* The locked prototype's animate(), rule by rule (founder lock 2026-10-06,
   "How screens move"). */

const s = (key: string, over: Partial<WalkScreen> = {}): WalkScreen => ({ key, ...over });
const page = s("page", { overlay: false });

describe("moveFor — nothing to move from", () => {
  it("the first screen does not move", () => {
    expect(moveFor(null, s("praise", { moment: 0 }))).toBe("none");
    expect(moveFor(undefined, s("praise"))).toBe("none");
  });

  it("an explicit 'none' never moves", () => {
    expect(moveFor(s("praise", { moment: 0 }), s("clearer", { moment: 1 }), "none")).toBe("none");
  });
});

describe("moveFor — the same screen redrawn", () => {
  it("a tick or a word on the same screen does not move", () => {
    const helpers = s("helpers", { moment: 2 });
    expect(moveFor(helpers, { ...helpers })).toBe("none");
    expect(moveFor(s("community"), s("community"))).toBe("none");
  });

  it("the same kind on another moment is another screen", () => {
    expect(moveFor(s("judge", { moment: 0 }), s("judge", { moment: 1 }))).toBe("next");
  });

  it("another try of the practise loop is another screen", () => {
    expect(walkSig(s("practise", { moment: 1, attempt: 0 }))).not.toBe(
      walkSig(s("practise", { moment: 1, attempt: 1 })),
    );
    expect(walkSig(s("practise", { moment: 1, kind: "words" }))).not.toBe(
      walkSig(s("practise", { moment: 1, kind: "instruction" })),
    );
  });

  it("an explicit direction moves even on the same screen", () => {
    const praise = s("praise", { moment: 0 });
    expect(moveFor(praise, praise, "back")).toBe("back");
    expect(moveFor(praise, praise, "forward")).toBe("next");
  });
});

describe("moveFor — the overlay appearing and leaving", () => {
  it("opening feedback over the page rises", () => {
    expect(moveFor(page, s("coachnote"))).toBe("open");
    expect(moveFor(page, s("praise", { moment: 3 }), "forward")).toBe("open");
  });

  it("closing it sinks back to the page", () => {
    expect(moveFor(s("praise", { moment: 0 }), page)).toBe("close");
    expect(moveFor(s("community"), s("end", { overlay: false }))).toBe("close");
  });

  it("page to page is not the walk's to move", () => {
    expect(moveFor(page, s("end", { overlay: false }))).toBe("none");
  });
});

describe("moveFor — next and back inside the overlay", () => {
  it("forward slides in from the right", () => {
    expect(moveFor(s("coachnote"), s("praise", { moment: 0 }))).toBe("next");
    expect(moveFor(s("praise", { moment: 0 }), s("helpers", { moment: 0 }), "forward")).toBe("next");
    expect(moveFor(s("clearer", { moment: 1 }), s("practise", { moment: 1 }))).toBe("next");
  });

  it("back mirrors it", () => {
    expect(moveFor(s("praise", { moment: 2 }), s("praise", { moment: 0 }), "back")).toBe("back");
  });
});

describe("moveFor — the soft cross-fade", () => {
  it("the screens that stand apart fade, coming and going, either way", () => {
    expect([...WALK_APART].sort()).toEqual(["community", "intro"]);
    expect(moveFor(s("helpers", { moment: 3 }), s("intro"))).toBe("fade");
    expect(moveFor(s("intro"), s("judge", { moment: 0 }))).toBe("fade");
    expect(moveFor(s("judge", { moment: 3 }), s("community"))).toBe("fade");
    expect(moveFor(s("judge", { moment: 0 }), s("intro"), "back")).toBe("fade");
  });

  it("one moment changing state fades: practise → checking → result", () => {
    expect([...WALK_SAME_MOMENT].sort()).toEqual(["encourage", "improved", "processing"]);
    expect(moveFor(s("practise", { moment: 1 }), s("processing", { moment: 1 }))).toBe("fade");
    expect(moveFor(s("processing", { moment: 1 }), s("improved", { moment: 1 }))).toBe("fade");
    expect(moveFor(s("processing", { moment: 1 }), s("encourage", { moment: 1 }))).toBe("fade");
  });

  it("arriving at a result from anywhere else is an ordinary next", () => {
    expect(moveFor(s("clearer", { moment: 1 }), s("encourage", { moment: 1 }))).toBe("next");
  });

  it("leaving a result for another screen is an ordinary next", () => {
    expect(moveFor(s("encourage", { moment: 1 }), s("exVideo", { moment: 1, attempt: 1 }))).toBe("next");
    expect(moveFor(s("improved", { moment: 1 }), s("helpers", { moment: 1 }))).toBe("next");
  });

  it("an explicit fade fades", () => {
    expect(moveFor(s("praise", { moment: 0 }), s("praise", { moment: 2 }), "fade")).toBe("fade");
  });
});

describe("leavesCopy — which moves keep the leaving screen", () => {
  it("every move with an out-animation keeps it; open and none do not", () => {
    expect(leavesCopy("next")).toBe(true);
    expect(leavesCopy("back")).toBe(true);
    expect(leavesCopy("fade")).toBe(true);
    expect(leavesCopy("close")).toBe(true);
    expect(leavesCopy("open")).toBe(false);
    expect(leavesCopy("none")).toBe(false);
  });
});
