// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

import {
  POST_STEPS,
  blankDraft,
  clampStep,
  clearDraft,
  loadDraft,
  saveDraft,
  slugify,
  stepsFor,
  type LaneDraft,
} from "./laneDraft";

/* -------------------------------------------------------------------------- */
/*  ONE ACTION PER SCREEN (founder 2026-09-16)                                 */
/*                                                                            */
/*  The CMS used to be one long two-column form. Adding a post walks six       */
/*  screens, each asking for one thing. The exercise lane that shared this     */
/*  file moved to the coach's own library and was retired here on 2026-09-30  */
/*  (founder B8), so /cms/new is the post lane and nothing else.              */
/*                                                                            */
/*  The rule that decides most of this file: an author who loses a lane        */
/*  halfway does not start again. So the draft survives navigation, a bad step */
/*  in the URL lands somewhere real, and every step knows what it needs before */
/*  it lets you past.                                                         */
/* -------------------------------------------------------------------------- */

const CLIENT = readFileSync("src/app/cms/new/page.client.tsx", "utf8");

function full(over: Partial<LaneDraft> = {}): LaneDraft {
  return {
    ...blankDraft("post"),
    title: "Land the ending",
    body: "Most people do not run out of breath.",
    slug: "land-the-ending",
    ...over,
  };
}

describe("the lane is the shape the founder locked", () => {
  it("is six steps for a post, and the only lane", () => {
    expect(POST_STEPS).toHaveLength(6);
    expect(stepsFor("post")).toBe(POST_STEPS);
    expect(stepsFor(full())).toBe(POST_STEPS);
  });

  it("names exactly the steps an author may walk past", () => {
    const skippable = POST_STEPS.filter((s) => s.skippable).map((s) => s.id);
    expect(skippable.sort()).toEqual(["community", "cover", "excerpt"]);
  });

  it("has no fork and no exercise lane left", () => {
    expect(CLIENT).not.toContain('"exercise"');
    expect(CLIENT).not.toContain("<Fork");
    expect(CLIENT).toContain('router.replace("/cms/new/post/1")');
  });
});

describe("a step will not let you past what it needs", () => {
  const problemOf = (id: string, draft: LaneDraft) =>
    POST_STEPS.find((s) => s.id === id)!.problem(draft);

  it("passes a complete draft at every step", () => {
    const draft = full();
    for (const step of POST_STEPS) {
      expect(step.problem(draft), step.id).toBeNull();
    }
  });

  it("asks for a title, a body and an address", () => {
    expect(problemOf("title", full({ title: " " }))).toMatch(/title/i);
    expect(problemOf("body", full({ body: "" }))).toMatch(/Write/);
    expect(problemOf("publish", full({ slug: "" }))).toMatch(/address/);
  });
});

describe("the draft survives the lane", () => {
  beforeEach(() => clearDraft());

  it("round-trips through the store", () => {
    const draft = full({ title: "Land the ending" });
    saveDraft(draft);
    expect(loadDraft()).toEqual(draft);
  });

  it("restores a draft written by an older build", () => {
    // A field added since must not throw the author back to step one.
    window.sessionStorage.setItem(
      "willpower.cms.lane",
      JSON.stringify({ lane: "post", title: "Half a draft" }),
    );
    const restored = loadDraft();
    expect(restored?.title).toBe("Half a draft");
    expect(restored?.category).toBe("others");
  });

  it("returns null for junk, and for the retired exercise lane", () => {
    for (const junk of ["{", "null", '{"lane":"nonsense"}', '{"lane":"exercise"}', "[]"]) {
      window.sessionStorage.setItem("willpower.cms.lane", junk);
      expect(() => loadDraft()).not.toThrow();
      expect(loadDraft()).toBeNull();
    }
  });
});

describe("a bad URL lands somewhere real", () => {
  it("clamps the step into the lane", () => {
    expect(clampStep("post", 0)).toBe(1);
    expect(clampStep("post", 99)).toBe(POST_STEPS.length);
    expect(clampStep("post", "3")).toBe(3);
  });

  it("never throws on nonsense", () => {
    for (const raw of ["x", undefined, null, {}, NaN]) {
      expect(clampStep("post", raw)).toBe(1);
    }
  });
});

describe("slugify", () => {
  it("turns a title into an address", () => {
    expect(slugify("Land the Ending!")).toBe("land-the-ending");
    expect(slugify("Land the Ending!", "_")).toBe("land_the_ending");
  });

  it("produces something legal, or nothing", () => {
    expect(slugify("9lives")).toBe("lives");
    expect(slugify("!!!")).toBe("");
  });
});

describe("the doors into the lane", () => {
  it("bounces to the CMS when the tab has no password, carrying where it was going", () => {
    expect(CLIENT).toContain("/cms?next=");
    expect(CLIENT).not.toContain('router.replace("/cms")');
  });
});
