import { describe, expect, it } from "vitest";
import { LIFE_VIEWS, panelMenu } from "./menu";
import type { LifeState } from "./types";

const base: LifeState = {
  consent: { requiredVersion: "2026-07-26", acceptedVersion: null },
  setup: { complete: false, resumeStep: null },
  menu: [],
};

const consented: LifeState = {
  ...base,
  consent: { requiredVersion: "2026-07-26", acceptedVersion: "2026-07-26" },
};

const active: LifeState = {
  ...consented,
  setup: { complete: true, resumeStep: null },
};

describe("panelMenu", () => {
  it("shows nothing when the panel does not exist for this caller", () => {
    // The kill switch sits upstream of everything else here.
    expect(panelMenu(null)).toEqual([]);
  });

  it("shows Principles alone before consent, so there is a door in", () => {
    expect(panelMenu(base).map((e) => e.key)).toEqual(["principles"]);
  });

  it("still shows Principles alone once consented but before setup", () => {
    // Setup is a hard gate. The other views would open on nothing, because
    // every route into the data runs through it.
    expect(panelMenu(consented).map((e) => e.key)).toEqual(["principles"]);
  });

  it("turns the rest on the moment the user is participating", () => {
    expect(panelMenu(active).map((e) => e.key)).toEqual([
      "principles",
      "wins",
      "phrases",
      "today",
      "week",
      "goals",
      "timeline",
      "distractions",
      "strategy",
    ]);
  });

  it("lets an explicit server menu win, which is the only way Prayer appears", () => {
    // Prayer is allowlisted and the FE cannot know the allowlist, so it is
    // never derived. A payload that wants it sends the whole list.
    const withPrayer: LifeState = {
      ...active,
      menu: [
        { key: "principles", label: "Principles", href: "/panel/principles" },
        {
          key: "prayer",
          label: "Prayer",
          href: "https://pompeiana.willpowerlab.com",
          external: true,
        },
      ],
    };
    expect(panelMenu(withPrayer).map((e) => e.key)).toEqual([
      "principles",
      "prayer",
    ]);
    expect(panelMenu(withPrayer)[1].external).toBe(true);
  });

  it("never derives an allowlisted entry", () => {
    expect(LIFE_VIEWS.some((v) => v.key === "prayer")).toBe(false);
  });

  it("lets the server pull a view without an FE deploy", () => {
    const trimmed: LifeState = {
      ...active,
      menu: [{ key: "principles", label: "Principles", href: "/panel/principles" }],
    };
    expect(panelMenu(trimmed).map((e) => e.key)).toEqual(["principles"]);
  });

  it("points every derived entry at a route the panel actually serves", () => {
    for (const view of LIFE_VIEWS) {
      expect(view.href, view.key).toBe(`/panel/${view.key}`);
      expect(view.label.trim(), view.key).not.toBe("");
    }
  });

  it("keeps Principles the only view reachable before setup", () => {
    const early = LIFE_VIEWS.filter((v) => !v.needsSetup).map((v) => v.key);
    expect(early).toEqual(["principles"]);
  });
});
