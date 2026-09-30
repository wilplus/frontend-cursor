import { describe, expect, it } from "vitest";
import { fill, formatRate, jarLabel, mapLedgerWeek, mapPaceRow, paceLine, sliderMax, weeksAt } from "./pace";

const row = (over: Partial<ReturnType<typeof mapPaceRow>> = {}) => ({
  jar: "pairs.praise_line",
  current: 12,
  bar: 200,
  observedRate: 4,
  weeksToBar: 47,
  caughtRate: null,
  caughtBar: null,
  ready: false,
  ...over,
});

describe("the pace panel's arithmetic", () => {
  it("maps a backend row and refuses a rowless shape", () => {
    expect(mapPaceRow({ jar: "shadow_cues.hedging", current: 4, bar: 30, observed_rate: null, weeks_to_bar: null, caught_rate: 0.85, caught_bar: 0.8, ready: false }))
      .toEqual({ jar: "shadow_cues.hedging", current: 4, bar: 30, observedRate: null, weeksToBar: null, caughtRate: 0.85, caughtBar: 0.8, ready: false });
    expect(mapPaceRow({ current: 1 })).toBeNull();
    expect(mapPaceRow(null)).toBeNull();
  });

  it("maps a stored week with its drafts and its export note", () => {
    const week = mapLedgerWeek({
      week_start: "2026-09-28",
      ready_cues: ["hedging"],
      migration_drafts: { hedging: { file: "migrations/hedging_is_detected.sql", manifest_line: "hedging_is_detected.sql", sql: "UPDATE …" } },
      exported: [{ surface: "praise_line", exported: 0, why: "door 2 closed" }],
      updated_at: "2026-09-28T06:00:00Z",
    });
    expect(week?.readyCues).toEqual(["hedging"]);
    expect(week?.migrationDrafts.hedging.file).toBe("migrations/hedging_is_detected.sql");
    expect(week?.exported[0]).toEqual({ surface: "praise_line", exported: 0, why: "door 2 closed" });
    expect(mapLedgerWeek({})).toBeNull();
  });

  it("counts weeks to the bar and never guesses without a rate", () => {
    expect(weeksAt(12, 200, 4)).toBe(47);
    expect(weeksAt(200, 200, 4)).toBe(0);
    expect(weeksAt(12, 200, 0)).toBeNull();
    expect(weeksAt(12, 200, null)).toBeNull();
    expect(weeksAt(null, 200, 4)).toBeNull();
  });

  it("reads the pace in words", () => {
    expect(paceLine(row())).toBe("4 a week → about 47 weeks to the bar");
    expect(paceLine(row({ observedRate: null, weeksToBar: null }))).toBe("no pace yet: fewer than two weekly readings");
    expect(paceLine(row({ current: 230 }))).toBe("at the bar");
    expect(paceLine(row({ current: null }))).toBe("count unavailable this week");
    expect(paceLine(row({ observedRate: -1.5, weeksToBar: null }))).toBe("not moving (-1.5 a week over the last readings)");
    expect(paceLine(row({ observedRate: 188, weeksToBar: 1 }))).toBe("188 a week → about 1 week to the bar");
  });

  it("fills the meter, labels the jars and bounds the slider", () => {
    expect(fill(50, 200)).toBe(0.25);
    expect(fill(250, 200)).toBe(1);
    expect(fill(null, 200)).toBe(0);
    expect(jarLabel("pairs.praise_line")).toBe("Praise lines (pairs)");
    expect(jarLabel("shadow_cues.hedging")).toBe("Cue “hedging” named by a coach");
    expect(formatRate(4.26)).toBe("4.3");
    expect(sliderMax(row())).toBe(200);
    expect(sliderMax(row({ current: 195 }))).toBe(10);
    expect(sliderMax(row({ current: 0, bar: 300 }))).toBe(300);
    expect(sliderMax(row({ current: 4, bar: 30 }))).toBe(30);
  });
});
