import { describe, expect, it } from "vitest";
import {
  coerceSetupAnswers,
  LIFE_SETUP_STEPS,
  pruneAnswers,
  stepIndex,
} from "./setupSteps";

/* Setup is the only entrance to the feature, and this module is what turns a
 * saved draft back into a form. A silent bug here loses somebody's answers
 * between two sittings, which is the one failure the save-and-resume design
 * exists to prevent. */

describe("LIFE_SETUP_STEPS", () => {
  it("asks for the bets before any goals", () => {
    // Every goal hangs off a bet, so goals first would produce goals with
    // nothing to hang from.
    expect(LIFE_SETUP_STEPS[0].kind).toBe("bets");
    expect(LIFE_SETUP_STEPS.slice(1).every((s) => s.kind === "goals")).toBe(true);
  });

  it("covers the eight horizons the spec names", () => {
    expect(LIFE_SETUP_STEPS.map((s) => s.key)).toEqual([
      "bets",
      "daily",
      "weekly",
      "monthly",
      "quarterly",
      "yearly",
      "five_year",
      "ten_year",
      "twenty_year",
    ]);
  });

  it("has unique step keys, since resume_step resolves against them", () => {
    const keys = LIFE_SETUP_STEPS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("stepIndex", () => {
  it("resumes on the saved step", () => {
    expect(stepIndex("quarterly")).toBe(4);
  });

  it("starts at the beginning for a missing or unknown step", () => {
    // A resume step the FE does not recognise must not strand the user on a
    // blank screen; starting over is recoverable, a blank screen is not.
    expect(stepIndex(null)).toBe(0);
    expect(stepIndex("fortnightly")).toBe(0);
  });
});

describe("coerceSetupAnswers", () => {
  it("returns the three ranked bets when the draft is empty", () => {
    const answers = coerceSetupAnswers(undefined);
    expect(answers.bets.map((b) => b.key)).toEqual(["life", "company", "dream"]);
    expect(answers.bets.map((b) => b.rank)).toEqual([1, 2, 3]);
  });

  it("gives every goal horizon a list, so no step renders undefined", () => {
    const answers = coerceSetupAnswers({});
    const goalSteps = LIFE_SETUP_STEPS.filter((s) => s.kind === "goals");
    for (const step of goalSteps) {
      expect(Array.isArray(answers.horizons[step.key]), step.key).toBe(true);
    }
  });

  it("restores a saved draft, sorted by the user's own rank", () => {
    const answers = coerceSetupAnswers({
      bets: [
        { key: "dream", rank: 3, meaning: "7T" },
        { key: "life", rank: 1, meaning: "family" },
        { key: "company", rank: 2, meaning: "willab" },
      ],
      horizons: {
        yearly: [
          {
            id: "yearly-1",
            title: "Ship the panel",
            dueLabel: "[Dec]",
            quantity: "1",
            measure: "it is live",
            betKey: "company",
          },
        ],
      },
    });
    expect(answers.bets.map((b) => b.key)).toEqual(["life", "company", "dream"]);
    expect(answers.horizons.yearly[0].dueLabel).toBe("[Dec]");
    expect(answers.horizons.yearly[0].betKey).toBe("company");
  });

  it("reads snake_case fields, so a round-trip through the backend survives", () => {
    const answers = coerceSetupAnswers({
      horizons: {
        monthly: [{ title: "Write", due_label: "[Aug]", bet_key: "life" }],
      },
    });
    expect(answers.horizons.monthly[0].dueLabel).toBe("[Aug]");
    expect(answers.horizons.monthly[0].betKey).toBe("life");
  });

  it("falls back to the default bets when a draft is missing one", () => {
    // A partial bets array would render a form with two bets and no way to add
    // the third, which is unrecoverable from inside the form.
    const answers = coerceSetupAnswers({ bets: [{ key: "life", rank: 1 }] });
    expect(answers.bets).toHaveLength(3);
  });

  it("drops an unknown bet key rather than rendering a bet that cannot be picked", () => {
    const answers = coerceSetupAnswers({
      bets: [
        { key: "life", rank: 1 },
        { key: "spendings", rank: 2 },
        { key: "company", rank: 3 },
      ],
    });
    expect(answers.bets.map((b) => b.key)).toEqual(["life", "company", "dream"]);
  });

  it("never throws on junk", () => {
    for (const junk of [null, "nope", 7, [], { horizons: "no" }, { bets: 3 }]) {
      expect(() => coerceSetupAnswers(junk)).not.toThrow();
    }
  });
});

describe("pruneAnswers", () => {
  it("drops blank rows the user left behind but keeps everything else", () => {
    const pruned = pruneAnswers({
      bets: [{ key: "life", rank: 1, meaning: "family" }],
      horizons: {
        daily: [
          { id: "1", title: "  ", dueLabel: "", quantity: "", measure: "", betKey: null },
          { id: "2", title: "Pray", dueLabel: "[NOW]", quantity: "", measure: "", betKey: "life" },
        ],
      },
    });
    expect(pruned.horizons.daily.map((g) => g.title)).toEqual(["Pray"]);
    expect(pruned.bets).toHaveLength(1);
  });

  it("keeps an empty horizon as an empty list, not as a missing key", () => {
    const pruned = pruneAnswers({ bets: [], horizons: { weekly: [] } });
    expect(pruned.horizons.weekly).toEqual([]);
  });
});
