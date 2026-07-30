import { describe, expect, it } from "vitest";
import {
  coerceSetupAnswers,
  LIFE_SETUP_STEPS,
  mergePrefill,
  placeUnplacedGoal,
  pruneAnswers,
  stepIndex,
  type LifePrefillRow,
  type LifeSetupAnswers,
  type LifeSetupGoal,
} from "./setupSteps";

/* Setup is the only entrance to the feature, and this module is what turns a
 * saved draft back into a form. A silent bug here loses somebody's answers
 * between two sittings, which is the one failure the save-and-resume design
 * exists to prevent. */

function goal(patch: Partial<LifeSetupGoal> = {}): LifeSetupGoal {
  return {
    id: "g",
    title: "A goal",
    dueLabel: "",
    quantity: "",
    measure: "",
    betKey: null,
    note: "",
    source: "user",
    confirmed: true,
    ...patch,
  };
}

function row(patch: Partial<LifePrefillRow> = {}): LifePrefillRow {
  return {
    title: "From the document",
    body: "",
    dueLabel: null,
    betKey: null,
    section: null,
    ...patch,
  };
}

function answers(patch: Partial<LifeSetupAnswers> = {}): LifeSetupAnswers {
  return {
    ...coerceSetupAnswers({}),
    ...patch,
  };
}

describe("LIFE_SETUP_STEPS", () => {
  it("asks for the bets before any goals", () => {
    // Every goal hangs off a bet, so goals first would produce goals with
    // nothing to hang from. The optional document step (founder 2026-07-30)
    // sits between them: it is not a goals editor, so the ordering rule it
    // must respect is only "after the bets, before the horizons".
    expect(LIFE_SETUP_STEPS[0].kind).toBe("bets");
    expect(LIFE_SETUP_STEPS[1].kind).toBe("document");
    expect(LIFE_SETUP_STEPS.slice(2).every((s) => s.kind === "goals")).toBe(true);
  });

  it("covers the eight horizons the spec names, plus the optional upload", () => {
    expect(LIFE_SETUP_STEPS.map((s) => s.key)).toEqual([
      "bets",
      "document",
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
    expect(stepIndex("quarterly")).toBe(5);
    expect(stepIndex("document")).toBe(1);
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
          goal({ id: "1", title: "  " }),
          goal({ id: "2", title: "Pray", dueLabel: "[NOW]", betKey: "life" }),
        ],
      },
      unplaced: [],
    });
    expect(pruned.horizons.daily.map((g) => g.title)).toEqual(["Pray"]);
    expect(pruned.bets).toHaveLength(1);
  });

  it("keeps an empty horizon as an empty list, not as a missing key", () => {
    const pruned = pruneAnswers({ bets: [], horizons: { weekly: [] }, unplaced: [] });
    expect(pruned.horizons.weekly).toEqual([]);
  });

  it("prunes the unplaced too, and keeps the ones with a title", () => {
    // The unplaced ride along in the answers so that every step's PUT saves
    // them. If pruning forgot the key they would be dropped on the first
    // save, which is exactly the loss the list exists to prevent.
    const pruned = pruneAnswers(
      answers({ unplaced: [goal({ id: "a", title: " " }), goal({ id: "b" })] })
    );
    expect(pruned.unplaced.map((g) => g.id)).toEqual(["b"]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Prefill from the uploaded document                                         */
/*                                                                            */
/*  Two things are being defended here, and they are the two the handoff calls */
/*  non-negotiable: a drafted row must never arrive looking accepted (N5), and */
/*  a goal the user wrote must never be dropped on the way in.                 */
/* -------------------------------------------------------------------------- */

describe("coerceSetupAnswers, on provenance", () => {
  it("treats a row saved before prefill existed as the user's own", () => {
    // Every goal in every draft written before 2026-07-30 was typed by hand.
    // Defaulting them to unconfirmed would put a "from your document" mark on
    // work somebody did themselves.
    const a = coerceSetupAnswers({
      horizons: { daily: [{ title: "Pray" }] },
    });
    expect(a.horizons.daily[0].source).toBe("user");
    expect(a.horizons.daily[0].confirmed).toBe(true);
  });

  it("keeps a drafted row unconfirmed across a save and a resume", () => {
    // The mark has to survive the round trip. A user who prefills, closes the
    // wizard and comes back two days later must still see which rows are the
    // document's and which are theirs.
    const a = coerceSetupAnswers({
      horizons: {
        weekly: [{ title: "Three deep-work blocks", source: "document", confirmed: false }],
      },
    });
    expect(a.horizons.weekly[0].source).toBe("document");
    expect(a.horizons.weekly[0].confirmed).toBe(false);
  });

  it("keeps a drafted row the user already kept", () => {
    const a = coerceSetupAnswers({
      horizons: { weekly: [{ title: "Ship", source: "document", confirmed: true }] },
    });
    expect(a.horizons.weekly[0].confirmed).toBe(true);
  });

  it("restores the unplaced, and defaults them to an empty list", () => {
    expect(coerceSetupAnswers({}).unplaced).toEqual([]);
    const a = coerceSetupAnswers({
      unplaced: [{ title: "Learn Greek", source: "document", confirmed: false }],
    });
    expect(a.unplaced.map((g) => g.title)).toEqual(["Learn Greek"]);
  });
});

describe("mergePrefill", () => {
  const KEYS = [
    "daily",
    "weekly",
    "monthly",
    "quarterly",
    "yearly",
    "five_year",
    "ten_year",
    "twenty_year",
  ];

  function payload(patch: Partial<{
    sections: Record<string, LifePrefillRow[]>;
    unplaced: LifePrefillRow[];
  }> = {}) {
    return { sections: {}, unplaced: [], ...patch };
  }

  it("puts each goal in its own step", () => {
    const out = mergePrefill(
      answers(),
      payload({
        sections: {
          weekly: [row({ title: "Three deep-work blocks" })],
          yearly: [row({ title: "Ship the panel" })],
        },
      }),
      KEYS
    );
    expect(out.answers.horizons.weekly.map((g) => g.title)).toEqual([
      "Three deep-work blocks",
    ]);
    expect(out.answers.horizons.yearly.map((g) => g.title)).toEqual([
      "Ship the panel",
    ]);
    expect(out.added).toBe(2);
  });

  it("lands every merged row marked and unconfirmed", () => {
    // N5, and the one non-negotiable in the handoff's list. A row that
    // arrived confirmed would be a row the user is told they approved.
    const out = mergePrefill(
      answers(),
      payload({ sections: { daily: [row()] }, unplaced: [row({ title: "Other" })] }),
      KEYS
    );
    for (const g of [...out.answers.horizons.daily, ...out.answers.unplaced]) {
      expect(g.source).toBe("document");
      expect(g.confirmed).toBe(false);
    }
  });

  it("appends after what the user typed, never in place of it", () => {
    const before = answers({
      horizons: {
        ...answers().horizons,
        weekly: [goal({ id: "mine", title: "My own goal" })],
      },
    });
    const out = mergePrefill(
      before,
      payload({ sections: { weekly: [row({ title: "Theirs" })] } }),
      KEYS
    );
    expect(out.answers.horizons.weekly.map((g) => g.title)).toEqual([
      "My own goal",
      "Theirs",
    ]);
    expect(out.answers.horizons.weekly[0].source).toBe("user");
  });

  it("converges instead of accumulating when it is run twice", () => {
    // Re-reading the same document must not double every row. The backend
    // makes this promise on its side; the client has its own two doors into
    // the prefill, so it makes it here too.
    const once = mergePrefill(
      answers(),
      payload({ sections: { daily: [row({ title: "Pray" })] } }),
      KEYS
    );
    const twice = mergePrefill(
      once.answers,
      payload({ sections: { daily: [row({ title: "  pray  " })] } }),
      KEYS
    );
    expect(twice.answers.horizons.daily).toHaveLength(1);
    expect(twice.added).toBe(0);
  });

  it("carries the due label verbatim and the bet through", () => {
    const out = mergePrefill(
      answers(),
      payload({
        sections: {
          monthly: [row({ title: "Write", dueLabel: "[Aug]", betKey: "company" })],
        },
      }),
      KEYS
    );
    // The label is the source of truth, so it arrives exactly as the user
    // wrote it, not normalised into a date nobody chose.
    expect(out.answers.horizons.monthly[0].dueLabel).toBe("[Aug]");
    expect(out.answers.horizons.monthly[0].betKey).toBe("company");
  });

  it("keeps whatever the document said past the title", () => {
    const out = mergePrefill(
      answers(),
      payload({ sections: { daily: [row({ body: "and mean it" })] } }),
      KEYS
    );
    expect(out.answers.horizons.daily[0].note).toBe("and mean it");
  });

  it("leaves quantity and measure empty rather than guessing them", () => {
    const out = mergePrefill(
      answers(),
      payload({ sections: { daily: [row()] } }),
      KEYS
    );
    expect(out.answers.horizons.daily[0].quantity).toBe("");
    expect(out.answers.horizons.daily[0].measure).toBe("");
  });

  it("surfaces the goals the document filed under nothing", () => {
    const out = mergePrefill(
      answers(),
      payload({ unplaced: [row({ title: "Learn Greek" })] }),
      KEYS
    );
    expect(out.answers.unplaced.map((g) => g.title)).toEqual(["Learn Greek"]);
    expect(out.added).toBe(1);
  });

  it("parks a section this build has no step for instead of dropping it", () => {
    // If the backend grows a ninth horizon first, those rows still have to
    // reach the user. Vanishing into a key nothing renders is the one
    // failure this feature cannot afford.
    const out = mergePrefill(
      answers(),
      payload({ sections: { fortnightly: [row({ title: "Orphan" })] } }),
      [...KEYS, "fortnightly"]
    );
    expect(out.answers.unplaced.map((g) => g.title)).toEqual(["Orphan"]);
    expect(out.added).toBe(1);
  });

  it("reads a section the server order forgot to mention", () => {
    const out = mergePrefill(
      answers(),
      payload({ sections: { weekly: [row({ title: "Still read" })] } }),
      ["daily"]
    );
    expect(out.answers.horizons.weekly.map((g) => g.title)).toEqual([
      "Still read",
    ]);
  });

  it("does not ask again about an unplaced goal already filed into a step", () => {
    const first = mergePrefill(
      answers(),
      payload({ unplaced: [row({ title: "Learn Greek" })] }),
      KEYS
    );
    const placed = placeUnplacedGoal(
      first.answers,
      first.answers.unplaced[0].id,
      "weekly"
    );
    expect(placed.horizons.weekly.map((g) => g.title)).toEqual(["Learn Greek"]);

    // Re-running the prefill must not put it back on the pile the user has
    // already taken it off. Deduping the unplaced against the unplaced alone
    // would hand it straight back and ask them to file it a second time.
    const again = mergePrefill(
      placed,
      payload({ unplaced: [row({ title: "Learn Greek" })] }),
      KEYS
    );
    expect(again.answers.unplaced).toEqual([]);
    expect(again.added).toBe(0);
  });

  it("ignores a row with no title", () => {
    const out = mergePrefill(
      answers(),
      payload({ sections: { daily: [row({ title: "   " })] } }),
      KEYS
    );
    expect(out.answers.horizons.daily).toEqual([]);
    expect(out.added).toBe(0);
  });

  it("leaves the bets alone", () => {
    // L-2a. The document may word a bet, it can never reorder them, and the
    // prefill has no business touching the ranks at all.
    const before = answers();
    const out = mergePrefill(
      before,
      payload({ sections: { daily: [row()] } }),
      KEYS
    );
    expect(out.answers.bets).toEqual(before.bets);
  });
});

describe("placeUnplacedGoal", () => {
  const withUnplaced = () =>
    answers({ unplaced: [goal({ id: "u1", title: "Learn Greek", source: "document", confirmed: false })] });

  it("moves the goal into the step and takes it off the pile", () => {
    const out = placeUnplacedGoal(withUnplaced(), "u1", "weekly");
    expect(out.unplaced).toEqual([]);
    expect(out.horizons.weekly.map((g) => g.title)).toEqual(["Learn Greek"]);
  });

  it("counts filing it as keeping it, and keeps the provenance", () => {
    const out = placeUnplacedGoal(withUnplaced(), "u1", "weekly");
    expect(out.horizons.weekly[0].confirmed).toBe(true);
    expect(out.horizons.weekly[0].source).toBe("document");
  });

  it("does nothing for a goal or a step that is not there", () => {
    const before = withUnplaced();
    expect(placeUnplacedGoal(before, "nope", "weekly")).toBe(before);
    expect(placeUnplacedGoal(before, "u1", "fortnightly")).toBe(before);
  });
});
