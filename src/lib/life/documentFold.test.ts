import { describe, expect, it } from "vitest";
import { foldDraftIntoAnswers } from "./documentFold";
import { coerceSetupAnswers, type LifeSetupAnswers } from "./setupSteps";
import type { LifeDraftItem } from "@/services/api/life";

/* -------------------------------------------------------------------------- */
/*  The fill has two jobs a test can hold: it must not lose a row, and it must */
/*  not write onto a screen the user has already walked past.                  */
/* -------------------------------------------------------------------------- */

function row(patch: Partial<LifeDraftItem>): LifeDraftItem {
  return {
    kind: "goal",
    title: "A goal",
    body: "",
    titleCut: null,
    // NOTE: these two default to the pre-`strategy_horizon` shape on purpose,
    // so the cases below keep exercising the fallback path a backend older
    // than the field still produces. The realistic payload — an ITEM horizon
    // plus a strategy_horizon — is exercised in "the two vocabularies" block.
    horizon: "weekly",
    strategyHorizon: null,
    dueLabel: null,
    bet: null,
    externalId: null,
    orderKey: 0,
    checked: true,
    ...patch,
  };
}

function empty(): LifeSetupAnswers {
  return coerceSetupAnswers({});
}

describe("foldDraftIntoAnswers", () => {
  it("fills a goal into the horizon it names", () => {
    const r = foldDraftIntoAnswers(
      [row({ title: "Ship the beta", horizon: "monthly" })],
      empty()
    );
    expect(r.filledGoals).toBe(1);
    expect(r.remainder).toEqual([]);
    expect(r.answers.horizons.monthly.map((g) => g.title)).toEqual([
      "Ship the beta",
    ]);
  });

  it("carries the due label verbatim and keeps the body as the measure", () => {
    const r = foldDraftIntoAnswers(
      [
        row({
          title: "Ten talks",
          horizon: "yearly",
          dueLabel: "[Dec]",
          body: "Counted from the calendar",
          bet: "company",
        }),
      ],
      empty()
    );
    const goal = r.answers.horizons.yearly[0];
    expect(goal.dueLabel).toBe("[Dec]");
    expect(goal.measure).toBe("Counted from the calendar");
    expect(goal.betKey).toBe("company");
  });

  it("appends beneath what the user already typed, never over it", () => {
    const answers = empty();
    answers.horizons.daily = [
      {
        id: "daily-1",
        title: "Mine",
        dueLabel: "",
        quantity: "",
        measure: "",
        betKey: null,
      },
    ];
    const r = foldDraftIntoAnswers(
      [row({ title: "Theirs", horizon: "daily" })],
      answers
    );
    expect(r.answers.horizons.daily.map((g) => g.title)).toEqual([
      "Mine",
      "Theirs",
    ]);
  });

  it("does not mutate the answers it was given", () => {
    const answers = empty();
    const before = JSON.stringify(answers);
    foldDraftIntoAnswers([row({ horizon: "daily" })], answers);
    expect(JSON.stringify(answers)).toBe(before);
  });

  it("skips a drafted row that repeats a goal already on the screen", () => {
    const answers = empty();
    answers.horizons.weekly = [
      {
        id: "weekly-1",
        title: "Write  the  memo",
        dueLabel: "",
        quantity: "",
        measure: "",
        betKey: null,
      },
    ];
    const r = foldDraftIntoAnswers(
      [row({ title: "write the memo" })],
      answers
    );
    expect(r.filledGoals).toBe(0);
    expect(r.answers.horizons.weekly).toHaveLength(1);
  });

  it("deduplicates within one draft too", () => {
    const r = foldDraftIntoAnswers(
      [row({ title: "Same" }), row({ title: "same " })],
      empty()
    );
    expect(r.filledGoals).toBe(1);
    expect(r.answers.horizons.weekly).toHaveLength(1);
  });

  it("gives every folded goal a distinct id", () => {
    const r = foldDraftIntoAnswers(
      [
        row({ title: "One", horizon: "daily" }),
        row({ title: "Two", horizon: "daily" }),
        row({ title: "Three", horizon: "weekly" }),
      ],
      empty()
    );
    const ids = [
      ...r.answers.horizons.daily,
      ...r.answers.horizons.weekly,
    ].map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The load-bearing one. A bet folded into step 0 would land text on a screen
  // the user already walked past, which is the failure the fold-forward rule
  // exists to prevent.
  it("never folds a bet, it sends it to the remainder for review", () => {
    const bet = row({ kind: "bet", title: "Company", bet: "company" });
    const r = foldDraftIntoAnswers([bet], empty());
    expect(r.filledGoals).toBe(0);
    expect(r.remainder).toEqual([bet]);
    expect(r.answers.bets).toEqual(empty().bets);
  });

  it("sends habits and distractions to the remainder", () => {
    const habit = row({ kind: "habit", title: "Walk", horizon: null });
    const distraction = row({ kind: "distraction", title: "Feed" });
    const r = foldDraftIntoAnswers([habit, distraction], empty());
    expect(r.remainder).toEqual([habit, distraction]);
  });

  // Contract drift must not eat the user's goal.
  it("sends a goal with an unknown horizon to the remainder rather than dropping it", () => {
    const odd = row({ title: "Someday", horizon: "century" });
    const r = foldDraftIntoAnswers([odd], empty());
    expect(r.filledGoals).toBe(0);
    expect(r.remainder).toEqual([odd]);
  });

  it("sends a goal with no horizon at all to the remainder", () => {
    const loose = row({ title: "Unplaced", horizon: null });
    expect(foldDraftIntoAnswers([loose], empty()).remainder).toEqual([loose]);
  });

  it("never folds into the bets or document steps even if named as a horizon", () => {
    const rows = [
      row({ title: "x", horizon: "bets" }),
      row({ title: "y", horizon: "document" }),
    ];
    const r = foldDraftIntoAnswers(rows, empty());
    expect(r.filledGoals).toBe(0);
    expect(r.remainder).toEqual(rows);
  });

  it("ignores a titleless row without counting it or passing it on", () => {
    const r = foldDraftIntoAnswers([row({ title: "   " })], empty());
    expect(r.filledGoals).toBe(0);
    expect(r.remainder).toEqual([]);
  });

  it("loses nothing: every row folds or comes back", () => {
    const rows = [
      row({ title: "a", horizon: "daily" }),
      row({ title: "b", horizon: "nope" }),
      row({ kind: "habit", title: "c" }),
      row({ kind: "bet", title: "d" }),
      row({ kind: "distraction", title: "e" }),
    ];
    const r = foldDraftIntoAnswers(rows, empty());
    expect(r.filledGoals + r.remainder.length).toBe(rows.length);
  });
});

/* -------------------------------------------------------------------------- */
/*  The two vocabularies                                                       */
/*                                                                             */
/*  `horizon` is when a goal is DUE: now | week | month | quarter | year |     */
/*  five_year | ten_year | twenty_year. A setup step key is which DOCUMENT it  */
/*  belongs to: daily | weekly | monthly | quarterly | yearly | five_year |    */
/*  ten_year | twenty_year. They overlap on exactly three values.              */
/*                                                                             */
/*  Folding on `horizon` therefore filled Five/Ten/Twenty years and left the   */
/*  first five screens empty — the bug in the 2026-08-01 screenshots. These    */
/*  use the payload the backend actually sends, which the cases above do not.  */
/* -------------------------------------------------------------------------- */

describe("foldDraftIntoAnswers — item horizons vs setup screens", () => {
  /** A row shaped the way /setup/propose-from-document really returns one. */
  function drafted(
    title: string,
    horizon: string,
    strategyHorizon: string | null
  ): LifeDraftItem {
    return row({ title, horizon, strategyHorizon });
  }

  it("fills every one of the eight screens from a full cascade", () => {
    const r = foldDraftIntoAnswers(
      [
        drafted("Morning pages", "now", "daily"),
        drafted("Ship the fix", "week", "weekly"),
        drafted("Close the phase", "month", "monthly"),
        drafted("Launch v2", "quarter", "quarterly"),
        drafted("Profitable", "year", "yearly"),
        drafted("A marriage with years on it", "five_year", "five_year"),
        drafted("The book", "ten_year", "ten_year"),
        drafted("The institute", "twenty_year", "twenty_year"),
      ],
      empty()
    );
    expect(r.filledGoals).toBe(8);
    expect(r.remainder).toEqual([]);
    for (const key of [
      "daily",
      "weekly",
      "monthly",
      "quarterly",
      "yearly",
      "five_year",
      "ten_year",
      "twenty_year",
    ]) {
      expect(r.answers.horizons[key]).toHaveLength(1);
    }
  });

  it("puts the short horizons on their screens, not in the remainder", () => {
    // The regression itself: `now` is not a step key, so reading `horizon`
    // sent this goal to the last-screen review instead of Daily.
    const r = foldDraftIntoAnswers(
      [drafted("Morning pages", "now", "daily")],
      empty()
    );
    expect(r.answers.horizons.daily.map((g) => g.title)).toEqual([
      "Morning pages",
    ]);
    expect(r.remainder).toEqual([]);
  });

  it("prefers the screen the backend named over the due horizon", () => {
    // The one case where trusting `horizon` would land the row on the WRONG
    // screen rather than none: both are step keys, and they disagree.
    const r = foldDraftIntoAnswers(
      [drafted("Ship it", "yearly", "monthly")],
      empty()
    );
    expect(r.answers.horizons.monthly.map((g) => g.title)).toEqual(["Ship it"]);
    expect(r.answers.horizons.yearly).toEqual([]);
  });

  it("falls back to the due horizon when the backend sends no screen", () => {
    // A backend older than the field. The long end still folds, exactly as it
    // did before — so this change ships safely ahead of that deploy.
    const r = foldDraftIntoAnswers(
      [
        drafted("A marriage with years on it", "five_year", null),
        drafted("Morning pages", "now", null),
      ],
      empty()
    );
    expect(r.answers.horizons.five_year).toHaveLength(1);
    expect(r.remainder.map((i) => i.title)).toEqual(["Morning pages"]);
  });

  it("still loses nothing when a row has neither", () => {
    const r = foldDraftIntoAnswers(
      [row({ title: "Homeless", horizon: null, strategyHorizon: null })],
      empty()
    );
    expect(r.filledGoals).toBe(0);
    expect(r.remainder.map((i) => i.title)).toEqual(["Homeless"]);
  });

  it("does not fold a non-goal even when it names a screen", () => {
    // Bets must stay in the remainder: their step is BEFORE the document step,
    // and folding backwards would write onto a screen already walked past.
    const r = foldDraftIntoAnswers(
      [row({ kind: "bet", title: "The Life", strategyHorizon: "daily" })],
      empty()
    );
    expect(r.filledGoals).toBe(0);
    expect(r.remainder).toHaveLength(1);
  });
});
