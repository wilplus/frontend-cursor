import { describe, expect, it } from "vitest";
import { isPastDue, orderGoals } from "./goalOrder";

/* -------------------------------------------------------------------------- */
/*  The complaint this answers, verbatim: "there is task for 29/07 and it is   */
/*  01/08. there can no be errors like that and goals are not sorted by the    */
/*  priority". So the two things pinned hardest are that a past date never     */
/*  reads as current, and that the ordering never scrambles the backend's own  */
/*  priority where no date overrules it.                                       */
/* -------------------------------------------------------------------------- */

const NOW = new Date(2026, 7, 1, 12, 0); // 01 Aug 2026, midday local

const g = (id: string, dueAt: string | null) => ({ id, dueAt });

describe("isPastDue", () => {
  it("marks the founder's exact case: due 29/07, read on 01/08", () => {
    expect(isPastDue(g("a", "2026-07-29"), NOW)).toBe(true);
  });

  it("keeps a goal due TODAY current for the whole day", () => {
    // Calendar days, local. Due-today is a must-do, not a failure at 00:01.
    expect(isPastDue(g("a", "2026-08-01"), NOW)).toBe(false);
    expect(isPastDue(g("a", "2026-08-01"), new Date(2026, 7, 1, 23, 59))).toBe(
      false
    );
  });

  it("treats undated and unparseable dates as not past due", () => {
    expect(isPastDue(g("a", null), NOW)).toBe(false);
    // Garbage in the field must read as undated, never explode or mark.
    expect(isPastDue(g("a", "not-a-date"), NOW)).toBe(false);
  });
});

describe("orderGoals", () => {
  it("orders: dated-soonest, then undated, then past-their-date last", () => {
    const ordered = orderGoals(
      [
        g("undated-1", null),
        g("overdue", "2026-07-29"),
        g("far", "2026-12-01"),
        g("near", "2026-08-03"),
        g("today", "2026-08-01"),
      ],
      NOW
    );
    expect(ordered.map((x) => x.id)).toEqual([
      "today",
      "near",
      "far",
      "undated-1",
      "overdue",
    ]);
  });

  it("keeps the server's order among undated goals, untouched", () => {
    // This is where the backend's own prioritisation (order_key, the
    // generation-side ranking) shows through. The FE must not shuffle it —
    // stability is the contract, not a nicety.
    const ordered = orderGoals(
      [g("b1", null), g("b2", null), g("b3", null)],
      NOW
    );
    expect(ordered.map((x) => x.id)).toEqual(["b1", "b2", "b3"]);
  });

  it("keeps the server's order among past-due goals too", () => {
    const ordered = orderGoals(
      [g("p1", "2026-07-20"), g("p2", "2026-07-29"), g("c", "2026-08-05")],
      NOW
    );
    expect(ordered.map((x) => x.id)).toEqual(["c", "p1", "p2"]);
  });

  it("computes nothing that could read as a score", () => {
    // AC-9 / N4, held structurally: the module's whole output is an array
    // order and a boolean. Nothing numeric leaves it, so nothing numeric can
    // be surfaced by a caller by accident.
    const ordered = orderGoals([g("a", "2026-08-03")], NOW);
    expect(ordered).toEqual([{ id: "a", dueAt: "2026-08-03" }]);
  });
});
