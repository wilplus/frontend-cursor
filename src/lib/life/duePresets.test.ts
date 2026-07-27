import { describe, expect, it } from "vitest";
import { duePresets } from "./duePresets";
import { LIFE_SETUP_STEPS } from "./setupSteps";

/** Pinned so the month/year maths is checkable rather than "whatever today is". */
const AUG_2026 = new Date(2026, 7, 15);

describe("duePresets", () => {
  it("offers the near months for the monthly horizon, from the given date", () => {
    expect(duePresets("monthly", AUG_2026)).toEqual(["[Aug]", "[Sep]", "[Oct]"]);
  });

  it("wraps the month names across a year boundary", () => {
    expect(duePresets("monthly", new Date(2026, 10, 1))).toEqual([
      "[Nov]",
      "[Dec]",
      "[Jan]",
    ]);
  });

  it("counts the long horizons off the given year", () => {
    expect(duePresets("five_year", AUG_2026)).toEqual(["2030", "2031", "2032"]);
    expect(duePresets("ten_year", AUG_2026)).toEqual(["2035", "2036", "2037"]);
    expect(duePresets("twenty_year", AUG_2026)).toEqual(["2045", "2046", "2047"]);
  });

  it("uses fixed notation where the horizon is not date-relative", () => {
    expect(duePresets("daily", AUG_2026)).toEqual(["[NOW]", "[today]", "[tonight]"]);
    expect(duePresets("quarterly", AUG_2026)).toEqual([
      "[Q1]",
      "[Q2]",
      "[Q3]",
      "[Q4]",
    ]);
  });

  it("returns none for an unknown horizon — free text, never a guess", () => {
    expect(duePresets("nonsense", AUG_2026)).toEqual([]);
    expect(duePresets("bets", AUG_2026)).toEqual([]);
  });

  it("covers every goals horizon in the setup flow", () => {
    // A new horizon added without presets would silently show a bare field.
    for (const step of LIFE_SETUP_STEPS) {
      if (step.kind !== "goals") continue;
      expect(duePresets(step.key, AUG_2026).length).toBeGreaterThan(0);
    }
  });

  it("is pure — the same inputs give the same answer", () => {
    expect(duePresets("monthly", AUG_2026)).toEqual(duePresets("monthly", AUG_2026));
  });

  it("never emits anything that needs parsing back (spec §3.2)", () => {
    // Labels are stored verbatim, so a chip must be something a person would
    // write, not an ISO date the UI would then have to render differently.
    for (const step of LIFE_SETUP_STEPS) {
      for (const preset of duePresets(step.key, AUG_2026)) {
        expect(preset).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});
