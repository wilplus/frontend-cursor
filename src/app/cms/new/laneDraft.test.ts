// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  POST_STEPS,
  blankDraft,
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

function full(over: Partial<LaneDraft> = {}): LaneDraft {
  return {
    ...blankDraft("post"),
    title: "Land the ending",
    body: "Most people do not run out of breath.",
    slug: "land-the-ending",
    ...over,
  };
}

describe("a step will not let you past what it needs", () => {
  const problemOf = (id: string, draft: LaneDraft) =>
    POST_STEPS.find((s) => s.id === id)!.problem(draft);

  it("asks for a title, a body and an address", () => {
    expect(problemOf("title", full({ title: " " }))).toMatch(/title/i);
    expect(problemOf("body", full({ body: "" }))).toMatch(/Write/);
    expect(problemOf("publish", full({ slug: "" }))).toMatch(/address/);
  });
});

