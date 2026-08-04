import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NOT_WARMED, WARMABLE_VIEWS } from "./prefetch";
import { LIFE_VIEWS } from "./menu";

const SRC = fileURLToPath(new URL("../../", import.meta.url));

/* -------------------------------------------------------------------------- */
/*  The warm-up has TWO silent failure modes, and this holds both ends.        */
/*                                                                            */
/*    · a view in the menu with no loader stays slow forever, and nothing      */
/*      says so — it just feels the way it felt before any of this;           */
/*    · a loader whose cache key does not match the view's warms a slot        */
/*      nobody reads, which is indistinguishable from doing nothing.          */
/*                                                                            */
/*  Neither throws. Neither shows up in a diff. So both are pinned here, and   */
/*  the cache-key half is checked by READING the view, not by restating the    */
/*  key in a second list that could drift with the first.                      */
/* -------------------------------------------------------------------------- */

/** The key a route's page passes to usePanelResource, read from the source. */
function keyInPage(href: string): string | null {
  const file = join(SRC, "app", href.replace(/^\//, ""), "page.tsx");
  const m = readFileSync(file, "utf8").match(/usePanelResource\(\s*"([^"]+)"/);
  return m ? m[1] : null;
}

describe("the warm-up registry", () => {
  it("covers every view in the menu, or names why not", () => {
    // The check that would catch a view staying slow: one added to LIFE_VIEWS
    // without a loader fails here rather than shipping unwarmed.
    const warmed = new Set(WARMABLE_VIEWS.map((v) => v.view));
    for (const view of LIFE_VIEWS) {
      const covered = warmed.has(view.key) || view.key in NOT_WARMED;
      expect(
        covered,
        `${view.key} is in the menu with no loader and no stated reason`
      ).toBe(true);
    }
  });

  it("exempts only what genuinely has nothing to warm", () => {
    // The data screen is chrome behind a control, not a pill. An exemption has
    // to be written down to exist.
    expect(Object.keys(NOT_WARMED).sort()).toEqual(["data"]);
  });

  it("warms nothing the menu does not offer", () => {
    const menu = new Set<string>(LIFE_VIEWS.map((v) => v.key));
    for (const { view } of WARMABLE_VIEWS) {
      expect(menu.has(view), `${view} is warmed but not in the menu`).toBe(true);
    }
  });
});

describe("warm-up keys", () => {
  it("warms the same key the view reads", () => {
    // Read from the page itself: a second hardcoded list would drift, and the
    // drift would be invisible because a mismatched key fails silently.
    for (const { href, cacheKey } of WARMABLE_VIEWS) {
      const inPage = keyInPage(href);
      if (inPage === null) continue; // reads through a component, checked below
      expect(inPage, href).toBe(cacheKey);
    }
  });

  it("keys the strategy view off the component that actually reads it", () => {
    // /panel/strategy renders StrategyPanel rather than reading in the page,
    // so the pairing lives one file over and is checked explicitly instead of
    // being skipped by the loop above.
    const source = readFileSync(
      join(SRC, "components", "life", "StrategyPanel.tsx"),
      "utf8"
    );
    const m = source.match(/usePanelResource\(\s*"([^"]+)"/);
    const entry = WARMABLE_VIEWS.find((v) => v.view === "strategy");
    expect(m?.[1]).toBe(entry?.cacheKey);
  });

  it("has no duplicate cache keys, which would warm one view into another", () => {
    const keys = WARMABLE_VIEWS.map((v) => v.cacheKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
