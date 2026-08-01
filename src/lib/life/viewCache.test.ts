import { beforeEach, describe, expect, it } from "vitest";
import { dropViews, fetchView, readView, warmViews } from "./viewCache";
import { PANEL_VIEW_LOADERS } from "./panelViews";
import { LIFE_VIEWS } from "./menu";

/* -------------------------------------------------------------------------- */
/*  The cache holds what makes the pill row instant, so what it must never do  */
/*  is as load-bearing as what it does: never two requests for one view, never */
/*  a cached failure, and never an answer that outlives a drop.                */
/* -------------------------------------------------------------------------- */

beforeEach(() => dropViews());

describe("viewCache", () => {
  it("remembers an answer and serves it back", async () => {
    await fetchView("wins", async () => ["a win"]);
    expect(readView("wins")).toEqual(["a win"]);
  });

  it("joins an in-flight request instead of issuing a twin", async () => {
    // The shell's warm-up and the view's own mount race on every panel open;
    // the view must JOIN the warm-up's request, not double it.
    let calls = 0;
    let release: (v: string) => void = () => {};
    const load = () => {
      calls += 1;
      return new Promise<string>((r) => {
        release = r;
      });
    };
    const a = fetchView("wins", load);
    const b = fetchView("wins", load);
    release("rows");
    expect(await a).toBe("rows");
    expect(await b).toBe("rows");
    expect(calls).toBe(1);
  });

  it("caches null as a real answer, distinct from absent", async () => {
    // fetchDay legitimately resolves to null. `undefined` must stay the one
    // spelling of "no answer yet", or Today would refetch forever.
    await fetchView("today", async () => null);
    expect(readView("today")).toBeNull();
    expect(readView("week")).toBeUndefined();
  });

  it("does not cache a failure, and a retry calls the loader again", async () => {
    let calls = 0;
    await expect(
      fetchView("goals", async () => {
        calls += 1;
        throw new Error("backend down");
      })
    ).rejects.toThrow();
    expect(readView("goals")).toBeUndefined();
    await fetchView("goals", async () => {
      calls += 1;
      return "ok";
    });
    expect(calls).toBe(2);
    expect(readView("goals")).toBe("ok");
  });

  it("warms only the views with neither an answer nor one in flight", async () => {
    await fetchView("wins", async () => "cached");
    let phrasesCalls = 0;
    let winsCalls = 0;
    warmViews({
      wins: async () => {
        winsCalls += 1;
        return "fresh";
      },
      phrases: async () => {
        phrasesCalls += 1;
        return "lines";
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(winsCalls).toBe(0);
    expect(phrasesCalls).toBe(1);
    expect(readView("wins")).toBe("cached");
    expect(readView("phrases")).toBe("lines");
  });

  it("swallows a failing loader during warm-up", async () => {
    // A warm-up is best-effort: the view it failed for still owns its own
    // honest error state on mount. Nothing must throw unhandled here.
    warmViews({
      bad: async () => {
        throw new Error("x");
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(readView("bad")).toBeUndefined();
  });

  it("a request that started before a drop cannot write after it", async () => {
    // The drop exists because the answer is known-stale (dock apply) or must
    // not exist at all (hard delete). A slow in-flight read resolving late
    // must not resurrect it.
    let release: (v: string) => void = () => {};
    const p = fetchView("wins", () => {
      return new Promise<string>((r) => {
        release = r;
      });
    });
    dropViews();
    release("pre-delete rows");
    await p;
    expect(readView("wins")).toBeUndefined();
  });

  it("after a drop, a new fetch is a new request that caches again", async () => {
    await fetchView("wins", async () => "old");
    dropViews();
    expect(readView("wins")).toBeUndefined();
    await fetchView("wins", async () => "new");
    expect(readView("wins")).toBe("new");
  });
});

describe("PANEL_VIEW_LOADERS", () => {
  it("covers exactly the views the menu lists", () => {
    // The warm-up and the menu must not drift: a view added to LIFE_VIEWS
    // without a loader here would silently stay slow, and a loader for a view
    // that does not exist would fetch into a slot nobody reads.
    expect(Object.keys(PANEL_VIEW_LOADERS).sort()).toEqual(
      LIFE_VIEWS.map((v) => v.key).sort()
    );
  });
});
