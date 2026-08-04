import { describe, expect, it, vi } from "vitest";
import {
  LIFE_VIEWS,
  RESOLVABLE_VIEWS,
  hamburgerMenu,
  panelChrome,
  panelMenu,
  resolveMenuEntry,
} from "./menu";
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

  it("lets an explicit server menu win, including an entry that leaves the app", () => {
    // A server-sent object carrying its own absolute href is rendered as an
    // anchor. This side derives no such entry; the server has to send one.
    const withExternal: LifeState = {
      ...active,
      menu: [
        { key: "principles", label: "Principles", href: "/panel/principles" },
        {
          key: "somewhere_else",
          label: "Somewhere else",
          href: "https://example.willpowerlab.com",
          external: true,
        },
      ],
    };
    expect(panelMenu(withExternal).map((e) => e.key)).toEqual([
      "principles",
      "somewhere_else",
    ]);
    expect(panelMenu(withExternal)[1].external).toBe(true);
  });

  /* Prayer is a SEPARATE app on pompeiana.willpowerlab.com, joined to this one
   * by the shared login and nothing else (founder 2026-08-04). This app is the
   * voice app: it neither derives nor resolves a prayer entry, and it holds no
   * label for one. These two guard the regression that took the whole app
   * down — `VIEWS.prayer.title` read at module scope, throwing before React
   * could mount anything, on every route including the error route. */
  it("does not derive a prayer entry", () => {
    expect(LIFE_VIEWS.some((v) => v.key === "prayer")).toBe(false);
  });

  it("does not resolve a prayer key the server sends, and does not throw on one", () => {
    expect(resolveMenuEntry("prayer")).toBeNull();
    expect(RESOLVABLE_VIEWS.has("prayer")).toBe(false);
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
    // A server-sent entry the panel does not own is not a room inside
    // Principles, so it must survive the filter rather than being swept up
    // with the sub-views.
    const withOutsider: LifeState = {
      ...active,
      menu: [
        { key: "principles", label: "Principles", href: "/panel/principles" },
        { key: "goals", label: "Goals", href: "/panel/goals" },
        { key: "somewhere_else", label: "Somewhere else", href: "/elsewhere" },
      ],
    };
    expect(hamburgerMenu(withOutsider).map((e) => e.key)).toEqual([
      "principles",
      "somewhere_else",
    ]);
  });

  it("is empty with no state, exactly as the panel nav is", () => {
    expect(hamburgerMenu(null)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/*  panelChrome (founder 2026-08-01)                                           */
/*                                                                             */
/*  The bug: setup stripped the WHOLE bar, and the gear linking to /panel/data */
/*  went with it. The Principles tab IS the setup form until setup finishes,   */
/*  and the pre-setup menu holds Principles alone, so that one line closed     */
/*  every route to the export and the hard delete — while the consent screen   */
/*  went on promising both were two clicks away.                               */
/* -------------------------------------------------------------------------- */

describe("panelChrome", () => {
  it("offers the data control DURING setup", () => {
    // The regression itself. Consenting and saving answers is already writing
    // something, so the way to erase it has to exist from that moment.
    expect(panelChrome(consented, true).showData).toBe(true);
  });

  it("still withholds the views during setup", () => {
    // The rule that stripped this chrome originally is intact: one thing on
    // the screen, no pill row reading "Principles" over "Your three bets".
    expect(panelChrome(consented, true).showViews).toBe(false);
    expect(panelChrome(active, false).showViews).toBe(true);
  });

  it("withholds the exit during setup, where the wizard draws its own", () => {
    // Two X buttons on one screen is worse than none.
    expect(panelChrome(consented, true).showExit).toBe(false);
    expect(panelChrome(active, false).showExit).toBe(true);
  });

  it("offers no data control before consent, setup or not", () => {
    // Nothing written yet, so there is nothing to take out or erase.
    expect(panelChrome(base, true).showData).toBe(false);
    expect(panelChrome(base, false).showData).toBe(false);
  });

  it("keeps offering the data control after setup completes", () => {
    expect(panelChrome(active, false).showData).toBe(true);
  });

  it("offers nothing at all with no state", () => {
    // The kill switch is upstream of everything here.
    expect(panelChrome(null, false)).toEqual({
      showViews: true,
      showData: false,
      showExit: true,
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  The outage guard (2026-08-04)                                             */
/*                                                                            */
/*  What actually took willpowerlab.com down was not a bad label. It was WHERE */
/*  the label was read: `VIEWS.prayer.title`, evaluated at module scope while  */
/*  this file's tables were being built. `VIEWS.prayer` was undefined in the   */
/*  bundle the browser ran, so the read threw during import — before React had */
/*  mounted anything, which is why no error boundary caught it and why the     */
/*  error route died with everything else. This module is reached from the app */
/*  menu in the root layout, so that was every page of the app.               */
/*                                                                            */
/*  This test does not care about prayer. It holds the invariant that outlives */
/*  it: importing this module must not throw, whatever copy.ts turns out to    */
/*  hold. A missing copy key is allowed to cost one wrong word in a menu. It   */
/*  is never again allowed to cost the whole app.                             */
/* -------------------------------------------------------------------------- */
describe("importing the menu module", () => {
  it("survives a copy module with every view title missing", async () => {
    vi.resetModules();
    vi.doMock("./copy", () => ({ VIEWS: {} }));

    const menu = await import("./menu");

    // It imported at all — that is the assertion the outage failed.
    expect(menu.LIFE_VIEWS.length).toBeGreaterThan(0);
    // And it degraded rather than blanked: every entry still has a word and a
    // route, so the menu renders instead of showing empty pills.
    for (const view of menu.LIFE_VIEWS) {
      expect(view.label.trim(), view.key).not.toBe("");
      expect(view.href, view.key).toBe(`/panel/${view.key}`);
    }

    vi.doUnmock("./copy");
    vi.resetModules();
  });
});
