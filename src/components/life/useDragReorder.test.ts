import { describe, expect, it } from "vitest";
import { projectAfterMove } from "./useDragReorder";

/* The drag itself is driven in a real browser (e2e/bets-reorder.spec.mjs) —
 * pointer plumbing is not something jsdom can answer. This covers the one part
 * that IS pure and is exactly where an off-by-one would hide: the position each
 * row is shown at while a drag is in flight, before anything is committed. */

/** The order the projection implies, as a readable string. */
const project = (items: string[], from: number, to: number): string => {
  const out: string[] = [];
  items.forEach((label, i) => {
    out[projectAfterMove(i, from, to)] = label;
  });
  return out.join("");
};

/** What the array actually looks like after the same move. */
const actual = (items: string[], from: number, to: number): string => {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.join("");
};

describe("projectAfterMove", () => {
  it("is a no-op when the row does not move", () => {
    expect(project(["A", "B", "C"], 1, 1)).toBe("ABC");
  });

  it("moving down pulls the rows in between up", () => {
    expect(project(["A", "B", "C"], 0, 1)).toBe("BAC");
    expect(project(["A", "B", "C"], 0, 2)).toBe("BCA");
  });

  it("moving up pushes the rows in between down", () => {
    expect(project(["A", "B", "C"], 2, 0)).toBe("CAB");
    expect(project(["A", "B", "C"], 1, 0)).toBe("BAC");
  });

  it("agrees with a real splice for every pair, at several lengths", () => {
    for (const n of [2, 3, 5, 8]) {
      const items = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
      for (let from = 0; from < n; from++) {
        for (let to = 0; to < n; to++) {
          expect(project(items, from, to), `n=${n} ${from}->${to}`).toBe(
            actual(items, from, to)
          );
        }
      }
    }
  });

  it("never projects a row outside the list", () => {
    const n = 6;
    for (let from = 0; from < n; from++) {
      for (let to = 0; to < n; to++) {
        for (let i = 0; i < n; i++) {
          const p = projectAfterMove(i, from, to);
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThan(n);
        }
      }
    }
  });
});
