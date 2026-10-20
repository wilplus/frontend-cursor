/*
 * STORY    As a speaker, I want the Life Panel menu to show only what I can
 *          use, so that I am never shown a feature I do not have.
 * OUTCOME
 *   O1  No panel for this caller (kill switch): no menu items at all.
 *   O2  Panel on but not set up: only the Principles entrance.
 *   O3  Consented and set up: every view, Principles first.
 *   O4  A server-sent menu is used exactly as sent.
 * PROVES   O1 -> "shows nothing when the panel does not exist for this caller"
 *          O2, O3 -> "opens the other views only once the speaker is set up"
 *          O4 -> "uses the server's own list when it sends one"
 */
import { describe, expect, it } from "vitest";
import { LIFE_VIEWS, panelMenu } from "./menu";
import type { LifeState } from "./types";

const state = (over: Partial<LifeState> = {}): LifeState => ({
  consent: { requiredVersion: "v1", acceptedVersion: null },
  setup: { complete: false, resumeStep: null },
  menu: [],
  ...over,
});

describe("panelMenu", () => {
  it("shows nothing when the panel does not exist for this caller", () => {
    expect(panelMenu(null)).toEqual([]);
  });

  it("opens the other views only once the speaker is set up", () => {
    expect(panelMenu(state()).map((e) => e.key)).toEqual(["principles"]);

    const ready = state({
      consent: { requiredVersion: "v1", acceptedVersion: "v1" },
      setup: { complete: true, resumeStep: null },
    });
    const keys = panelMenu(ready).map((e) => e.key);
    expect(keys[0]).toBe("principles");
    expect(keys).toEqual(LIFE_VIEWS.map((v) => v.key));
    expect(keys.length).toBeGreaterThan(1);
  });

  it("uses the server's own list when it sends one", () => {
    const menu = [{ key: "wins", label: "Wins", href: "/panel/wins" }];
    expect(panelMenu(state({ menu }))).toEqual(menu);
  });
});
