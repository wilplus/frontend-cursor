import { describe, expect, it } from "vitest";
import { LIFE_VIEWS, hamburgerMenu, panelMenu } from "./menu";
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

  it("never carries the data screen, on any payload", () => {
    // L-6 / FE-10. Export and hard delete are promised on the consent screen
    // as living in the panel two clicks away, so the way to them must not be
    // something a payload can remove. A `menu` sent by the server REPLACES the
    // derived list wholesale (the test above pins that), so a data entry added
    // to LIFE_VIEWS would hold for most users and silently vanish for exactly
    // the allowlisted ones the server enumerates.
    //
    // PanelShell renders that link itself, gated on consent and nothing else.
    // This test is what stops the next person "tidying" it into the list.
    expect(LIFE_VIEWS.some((v) => v.key === "data")).toBe(false);
    for (const state of [base, consented, active]) {
      expect(panelMenu(state).some((e) => e.href === "/panel/data")).toBe(false);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  The hamburger vs the panel's own nav (founder 2026-08-01)                   */
/*                                                                             */
/*  One function used to feed both, so the eight views inside the Principles   */
/*  tab were also listed in the app-wide menu — the same destinations offered  */
/*  twice. The hamburger now shows the door only. The risk this block exists   */
/*  to hold: filtering the SHARED list instead of splitting it would have made */
/*  those views unreachable from anywhere.                                     */
/* -------------------------------------------------------------------------- */

describe("hamburgerMenu", () => {
  it("shows Principles and nothing else once the panel is unlocked", () => {
    expect(hamburgerMenu(active).map((e) => e.key)).toEqual(["principles"]);
  });

  it("still shows Principles before setup, because it is the door", () => {
    expect(hamburgerMenu(consented).map((e) => e.key)).toEqual(["principles"]);
    expect(hamburgerMenu(base).map((e) => e.key)).toEqual(["principles"]);
  });

  it("does not take the views away from the panel's own nav", () => {
    // The whole point of splitting rather than filtering. If this ever equals
    // the hamburger, the eight views have nowhere left to be reached from.
    const inside = panelMenu(active).map((e) => e.key);
    expect(inside).toContain("goals");
    expect(inside).toContain("timeline");
    expect(inside.length).toBeGreaterThan(hamburgerMenu(active).length);
  });

  it("drops every view the Principles tab already lists", () => {
    // Stated as a relationship, not a hardcoded list, so a view added to
    // LIFE_VIEWS later lands inside the tab rather than in the hamburger.
    const hamburger = new Set(hamburgerMenu(active).map((e) => e.key));
    for (const view of LIFE_VIEWS) {
      if (view.key === "principles") continue;
      expect(hamburger.has(view.key)).toBe(false);
    }
  });

  it("keeps an entry that is not a panel view at all", () => {
    // Prayer is its own app, not a room inside Principles, so a server-sent
    // entry the panel does not own must survive the filter.
    const withPrayer: LifeState = {
      ...active,
      menu: [
        { key: "principles", label: "Principles", href: "/panel/principles" },
        { key: "goals", label: "Goals", href: "/panel/goals" },
        { key: "prayer", label: "Prayer", href: "/prayer" },
      ],
    };
    expect(hamburgerMenu(withPrayer).map((e) => e.key)).toEqual([
      "principles",
      "prayer",
    ]);
  });

  it("is empty with no state, exactly as the panel nav is", () => {
    expect(hamburgerMenu(null)).toEqual([]);
  });
});
