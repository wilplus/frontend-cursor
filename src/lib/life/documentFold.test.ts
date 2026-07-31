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
    horizon: "weekly",
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
