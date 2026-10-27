/*
STORY    As a speaker reading Will's ask for the plan's own yes, I want Read
         more to open exactly Privacy section 4e, so that I read what I am
         saying yes to and nothing else.
OUTCOME
  O1  Section 4e is shown from its heading to the next numbered heading; a
      copy without it is shown whole rather than not at all.
PROVES   O1 -> "Read more opens section 4e and stops at the next heading"
WHY      Founder 2026-10-27, the plan's own yes (backend N211).
*/
import { expect, it } from "vitest";
import { planSection } from "./policySection";

const POLICY = [
  "4d. OTHER",
  "Other text.",
  "",
  "4e. YOUR PLAN: PERSONAL ANSWERS — OPTIONAL",
  "",
  "Part of your plan is personal.",
  "",
  "5. WHO ELSE SEES IT",
  "Not this.",
].join("\n");

it("Read more opens section 4e and stops at the next heading", () => {
  expect(planSection(POLICY)).toBe("4e. YOUR PLAN: PERSONAL ANSWERS — OPTIONAL\n\nPart of your plan is personal.");
  expect(planSection("No headings here.")).toBe("No headings here.");
});
