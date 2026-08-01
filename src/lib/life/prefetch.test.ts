import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { WARMABLE_KEYS } from "./prefetch";

const SRC = fileURLToPath(new URL("../../", import.meta.url));

/* -------------------------------------------------------------------------- */
/*  A warm read that lands in the wrong slot is INVISIBLE: nothing throws, no  */
/*  test fails, and the only symptom is "the panel is still slow". So the      */
/*  prefetch keys are held against the keys the views actually pass to         */
/*  usePanelResource, by reading the views.                                    */
/* -------------------------------------------------------------------------- */

/** The key a route's page passes to usePanelResource, read from the source. */
function keyInPage(href: string): string | null {
  const file = join(SRC, "app", `${href.replace(/^\//, "")}`, "page.tsx");
  const source = readFileSync(file, "utf8");
  const m = source.match(/usePanelResource\(\s*"([^"]+)"/);
  return m ? m[1] : null;
}

describe("prefetch keys", () => {
  it("warms the same key the view reads", () => {
    for (const [href, key] of WARMABLE_KEYS) {
      expect(keyInPage(href), href).toBe(key);
    }
  });

  it("covers every kind-holding view a pill can reach", () => {
    const routes = WARMABLE_KEYS.map(([href]) => href);
    for (const href of [
      "/panel/principles",
      "/panel/wins",
      "/panel/phrases",
      "/panel/distractions",
      "/panel/goals",
      "/panel/today",
      "/panel/week",
      "/panel/timeline",
    ]) {
      expect(routes, href).toContain(href);
    }
  });

  it("has no duplicate keys, which would warm one view into another", () => {
    const keys = WARMABLE_KEYS.map(([, key]) => key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
