import { describe, expect, it } from "vitest";
import {
  clampScale,
  MAX_PX_PER_DAY,
  MIN_PX_PER_DAY,
  tickLabel,
  ticksFor,
  tierForScale,
  timeToX,
  windowFor,
  xToTime,
} from "./timelineScale";

describe("tierForScale", () => {
  it("switches tier with scale so 240 quarters never render at once", () => {
    expect(tierForScale(MIN_PX_PER_DAY)).toBe("decade");
    expect(tierForScale(1200 / (12 * 365))).toBe("year");
    expect(tierForScale(MAX_PX_PER_DAY)).toBe("quarter");
  });

  it("covers all three tiers across the full zoom range", () => {
    const tiers = new Set(
      [MIN_PX_PER_DAY, 0.2, MAX_PX_PER_DAY].map(tierForScale)
    );
    expect([...tiers].sort()).toEqual(["decade", "quarter", "year"]);
  });
});

describe("clampScale", () => {
  it("keeps zoom between about a month and about sixty years", () => {
    expect(clampScale(0)).toBe(MIN_PX_PER_DAY);
    expect(clampScale(1e9)).toBe(MAX_PX_PER_DAY);
    expect(clampScale(0.5)).toBe(0.5);
  });
});

describe("ticksFor", () => {
  const from = Date.UTC(2026, 0, 15);
  const to = Date.UTC(2029, 0, 15);

  it("emits quarter boundaries", () => {
    const ticks = ticksFor("quarter", from, to);
    expect(ticks.length).toBe(12);
    expect(new Date(ticks[0]).getUTCMonth() % 3).toBe(0);
  });

  it("emits one tick per year", () => {
    expect(ticksFor("year", from, to).length).toBe(3);
  });

  it("snaps decades to the decade boundary", () => {
    const ticks = ticksFor("decade", Date.UTC(2026, 0, 1), Date.UTC(2086, 0, 1));
    expect(new Date(ticks[0]).getUTCFullYear()).toBe(2030);
    expect(ticks.length).toBe(6);
  });

  it("returns nothing for an inverted or unusable range", () => {
    expect(ticksFor("year", to, from)).toEqual([]);
    expect(ticksFor("year", Number.NaN, to)).toEqual([]);
  });
});

describe("tickLabel", () => {
  it("labels each tier in its own units", () => {
    const t = Date.UTC(2027, 3, 1);
    expect(tickLabel("quarter", t)).toBe("Q2 27");
    expect(tickLabel("year", t)).toBe("2027");
    expect(tickLabel("decade", Date.UTC(2030, 0, 1))).toBe("2030s");
  });
});

describe("time and x round-trip", () => {
  it("maps a time to a pixel and back", () => {
    const center = Date.UTC(2026, 6, 26);
    const target = Date.UTC(2027, 6, 26);
    const x = timeToX(target, center, 0.5, 1000);
    expect(xToTime(x, center, 0.5, 1000)).toBeCloseTo(target, -3);
  });

  it("centres the window on the given time", () => {
    const center = Date.UTC(2026, 6, 26);
    const { fromMs, toMs } = windowFor(center, 1, 730);
    expect((toMs - fromMs) / 86_400_000).toBeCloseTo(730, 5);
    expect((fromMs + toMs) / 2).toBe(center);
  });
});
