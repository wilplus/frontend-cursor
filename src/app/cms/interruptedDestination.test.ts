// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE CMS DEEP LINK SURVIVES THE PASSWORD GATE (founder 2026-09-24). The     */
/*  gate bounced to /cms and dropped the lane and the step; it now carries     */
/*  them. Moved out of the coach hand-off tests when the take-review overlay   */
/*  and the arc-level delivery went (founder 2026-09-30, B3 to B6; P2-19).     */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { interruptedDestination } from "@/app/cms/interruptedDestination";

const SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("the CMS deep link survives the password gate", () => {
  const AT = (search: string) => {
    window.history.replaceState({}, "", `/cms${search}`);
  };

  it("resumes an authoring destination", () => {
    AT("?next=%2Fcms%2Fnew%2Fpost%2F3");
    expect(interruptedDestination()).toBe("/cms/new/post/3");
  });

  it("refuses anything that is not an authoring path", () => {
    // The value arrives in a query parameter, so it is attacker-supplied by
    // construction; an open redirect out of the CMS is the failure to avoid.
    for (const bad of [
      "https://evil.example/cms/new/",
      "//evil.example/cms/new/",
      "/chat?review=x",
      "/cms",
      "/cms/newish/post/1",
      "/cms/gaps",
      "",
    ]) {
      AT(`?next=${encodeURIComponent(bad)}`);
      expect(interruptedDestination()).toBeNull();
    }
  });

  it("is null when nothing was interrupted", () => {
    AT("");
    expect(interruptedDestination()).toBeNull();
  });

  it("the bounce carries the destination rather than dropping it", () => {
    const gate = read(join("app", "cms", "new", "page.client.tsx"));
    // A bare router.replace("/cms") is the bug: it loses the lane, the step
    // and the returnTo in one line.
    expect(gate).not.toContain('router.replace("/cms")');
    expect(gate).toContain("/cms?next=");
  });
});
