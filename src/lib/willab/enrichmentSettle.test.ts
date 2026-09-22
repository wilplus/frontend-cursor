import { describe, expect, it } from "vitest";
import {
  SETTLE_CEILING_MS,
  SETTLE_DELAYS_MS,
  SETTLE_MAX_ATTEMPTS,
  PROMPT_LANE,
  SLOW_LANE,
  feedbackStillComing,
  nextSettleDelayMs,
  retryableSections,
  settleDelayMs,
} from "./enrichmentSettle";

/* -------------------------------------------------------------------------- */
/*  THE LOADING BUG (founder 2026-09-20)                                       */
/*                                                                            */
/*  "after a while, after I closed it, or not even closing it, I just left it  */
/*  alone for a while. It refetched and then displayed. So this is just a      */
/*  loading bug."                                                             */
/*                                                                            */
/*  The bookmarks are computed inside the `document_layers` enrichment reader. */
/*  When it outruns its server budget the section comes back retryable, and    */
/*  the page used to ask three more times — 200/500/1000ms — and then stop.    */
/*  Nothing re-reads the document after the first paint, so a Take whose       */
/*  Manager work took longer than that lost its marks until an unrelated       */
/*  refetch happened to run the whole dance again.                            */
/*                                                                            */
/*  What is guarded here is the SHAPE of the new budget: that it is longer     */
/*  than the old one, that it is bounded in BOTH directions (wall clock and    */
/*  request count), that it widens rather than polls, and — the part that      */
/*  actually fixes the founder's screen — that "we stopped asking" stays       */
/*  distinguishable from "the server finished".                               */
/* -------------------------------------------------------------------------- */

describe("the settle budget", () => {
  it("is much longer than the three tries that lost the marks", () => {
    // The old schedule: three attempts, 1.7 seconds of waiting in total.
    const oldWaits = 200 + 500 + 1000;
    const newWaits = Array.from({ length: SETTLE_MAX_ATTEMPTS }, (_, i) =>
      settleDelayMs(i),
    ).reduce((a, b) => a + b, 0);
    expect(SETTLE_MAX_ATTEMPTS).toBeGreaterThan(3);
    expect(newWaits).toBeGreaterThan(oldWaits * 5);
  });

  it("is bounded in BOTH directions", () => {
    // The ceiling alone would not bound the requests if the server answered
    // instantly and kept saying retryable; the attempt cap alone would not
    // bound the wall clock if every request took its full server budget.
    expect(SETTLE_MAX_ATTEMPTS).toBeGreaterThan(0);
    expect(Number.isFinite(SETTLE_CEILING_MS)).toBe(true);
    expect(nextSettleDelayMs(SETTLE_MAX_ATTEMPTS, 0)).toBeNull();
    expect(nextSettleDelayMs(0, SETTLE_CEILING_MS)).toBeNull();
  });

  it("widens rather than polls", () => {
    // A fixed short delay against work that takes tens of seconds is a poll
    // with extra steps. Each wait is at least as long as the one before it.
    for (let i = 1; i < SETTLE_DELAYS_MS.length; i += 1) {
      expect(SETTLE_DELAYS_MS[i]).toBeGreaterThanOrEqual(SETTLE_DELAYS_MS[i - 1]);
    }
    expect(SETTLE_DELAYS_MS[SETTLE_DELAYS_MS.length - 1]).toBeGreaterThan(
      SETTLE_DELAYS_MS[0],
    );
  });

  it("starts fast, because most Takes just miss the first budget", () => {
    // The common case is a reader that finished a beat after its two-second
    // budget. Waiting four seconds to find that out would be a regression for
    // every Take that used to work.
    expect(settleDelayMs(0)).toBeLessThanOrEqual(500);
  });

  it("holds the last delay rather than growing without limit", () => {
    const last = SETTLE_DELAYS_MS[SETTLE_DELAYS_MS.length - 1];
    expect(settleDelayMs(SETTLE_DELAYS_MS.length)).toBe(last);
    expect(settleDelayMs(SETTLE_DELAYS_MS.length + 50)).toBe(last);
  });

  it("clamps a nonsense attempt to the first delay", () => {
    expect(settleDelayMs(-1)).toBe(SETTLE_DELAYS_MS[0]);
    expect(settleDelayMs(0.4)).toBe(SETTLE_DELAYS_MS[0]);
  });
});

describe("nextSettleDelayMs — may we ask again?", () => {
  it("yes, while both budgets have room", () => {
    expect(nextSettleDelayMs(0, 0)).toBe(SETTLE_DELAYS_MS[0]);
    expect(nextSettleDelayMs(2, 10_000)).toBe(SETTLE_DELAYS_MS[2]);
  });

  it("no, once the wall clock is spent", () => {
    expect(nextSettleDelayMs(1, SETTLE_CEILING_MS)).toBeNull();
    expect(nextSettleDelayMs(1, SETTLE_CEILING_MS + 1)).toBeNull();
  });

  it("no, once the request budget is spent", () => {
    expect(nextSettleDelayMs(SETTLE_MAX_ATTEMPTS, 0)).toBeNull();
    expect(nextSettleDelayMs(SETTLE_MAX_ATTEMPTS + 3, 0)).toBeNull();
  });

  it("honours a caller's own ceiling", () => {
    // The overlay tests need a short one; nothing should have to wait ninety
    // seconds to prove the budget ends.
    expect(nextSettleDelayMs(0, 0, 50)).toBe(SETTLE_DELAYS_MS[0]);
    expect(nextSettleDelayMs(0, 50, 50)).toBeNull();
  });

  it("refuses a non-finite clock or attempt rather than looping", () => {
    expect(nextSettleDelayMs(Number.NaN, 0)).toBeNull();
    expect(nextSettleDelayMs(0, Number.NaN)).toBeNull();
    expect(nextSettleDelayMs(Number.POSITIVE_INFINITY, 0)).toBeNull();
    expect(nextSettleDelayMs(0, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("gives the exercise of asking a real chance before the ceiling", () => {
    // Walk the schedule the way the loop does, charging each attempt the
    // server's own focused-retry budget (8s in explore_ideal_text.py). The
    // budget has to survive several of those, or the fix does nothing.
    const SERVER_BUDGET_MS = 8_000;
    let elapsed = 0;
    let attempts = 0;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const delay = nextSettleDelayMs(attempt, elapsed);
      if (delay === null) break;
      elapsed += delay + SERVER_BUDGET_MS;
      attempts += 1;
    }
    expect(attempts).toBeGreaterThanOrEqual(5);
    expect(attempts).toBeLessThanOrEqual(SETTLE_MAX_ATTEMPTS);
  });
});

describe("retryableSections — the server's own word", () => {
  it("names only the sections that asked to be asked again", () => {
    expect(
      retryableSections({
        document_layers: { retryable: true },
        feedback: {},
        journey: { retryable: false },
        history: { retryable: true },
      }),
    ).toEqual(["document_layers", "history"]);
  });

  it("is a stable order, so two identical settles send identical requests", () => {
    expect(
      retryableSections({ history: { retryable: true }, document_layers: { retryable: true } }),
    ).toEqual(["document_layers", "history"]);
  });

  it("treats a missing or truthy-but-not-true flag as no", () => {
    // `retryable` is omitted entirely when the reader finished — see
    // EnrichmentSection.wire(). Anything else is not the server saying yes.
    expect(retryableSections({ a: {} })).toEqual([]);
    expect(
      retryableSections({
        a: { retryable: "yes" as unknown as boolean },
      }),
    ).toEqual([]);
  });

  it("survives an empty or absent section map", () => {
    expect(retryableSections({})).toEqual([]);
    expect(
      retryableSections(
        undefined as unknown as Record<string, { retryable?: boolean }>,
      ),
    ).toEqual([]);
  });
});

describe("feedbackStillComing — the question the reserved slot is asking", () => {
  it("is true while the server is still asking to be asked", () => {
    expect(feedbackStillComing({ document_layers: { retryable: true } })).toBe(
      true,
    );
  });

  it("is false when every reader answered", () => {
    // THE FOUNDER'S BUG IN ONE LINE. A settle that ran out of budget returns
    // kind: "ready" exactly like one that finished; only the sections tell
    // them apart. Reading the envelope is what dropped the marks.
    expect(feedbackStillComing({ document_layers: {}, feedback: {} })).toBe(
      false,
    );
  });

  it("is false with nothing to report, so an honest empty lane closes", () => {
    // 24c/24d: coverage is a target on selection, never a floor on output.
    // A Take with no marks must not hold a slot open forever.
    expect(feedbackStillComing({})).toBe(false);
  });

  it("does not wait on the learning layer (founder 2026-09-21)", () => {
    // PRODUCTION: `learning` failed on every read — a canonical `takes` row
    // exists only for the data-foundation canary owner, so the exposure
    // receipt write was refused — and came back retryable. The deck read that
    // as "feedback still coming", held the empty slot for the whole budget,
    // and drew no bookmarks over a Take whose `document_layers` had answered
    // in full. An F2 section must never hide an F1 mark (R12, backend #574).
    expect(
      feedbackStillComing({
        document_layers: {},
        feedback: {},
        learning: { retryable: true },
      }),
    ).toBe(false);
  });

  it("still waits for either mark section", () => {
    expect(feedbackStillComing({ feedback: { retryable: true } })).toBe(true);
    expect(
      feedbackStillComing({
        document_layers: { retryable: true },
        learning: { retryable: true },
      }),
    ).toBe(true);
  });
});

describe("the two lanes a first open asks in", () => {
  it("puts the slow section on its own, so nothing can hold it up", () => {
    /* FOUNDER 2026-09-22: "can you do something to make loading of the
       bookmarks faster? cause it is really long."

       The server picks its budget from what is asked for. The marks alone
       earn the long one; everything else keeps the tight one. Both go at
       once, so the speaker waits for the Manager and nothing else. */
    expect(SLOW_LANE).toEqual(["document_layers"]);
  });

  it("covers every section the page reads, exactly once", () => {
    // `mergeIdealTextEnrichment` names these seven. A section in neither
    // lane is one the page silently stops receiving; one in both is a
    // duplicate Manager run.
    const asked = [...SLOW_LANE, ...PROMPT_LANE];
    expect(new Set(asked).size).toBe(asked.length);
    expect([...asked].sort()).toEqual([
      "document_layers", "entitlement", "feedback",
      "history", "journey", "learning", "notes",
    ]);
  });

  it("keeps the failing F2 receipt away from the marks", () => {
    // `learning` fails on every read in production today (G-1). It must
    // never share a lane with the bookmarks, or its budget becomes theirs.
    expect(SLOW_LANE).not.toContain("learning");
    expect(PROMPT_LANE).toContain("learning");
  });
});
