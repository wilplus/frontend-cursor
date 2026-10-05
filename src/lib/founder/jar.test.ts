/* The jar's two reads on the pace panel (B8, C9, E9). Pins: the jar maps
 * the backend's readiness counts and nothing about outcomes; an unreadable
 * source is unknown, never zero; a reason the backend adds later is kept;
 * the evaluation is absent until served, fail-closed sealed, and two piles
 * only when the backend says unsealed. */
import { describe, expect, it } from "vitest";
import { jarCount, mapExerciseJar, mapJarEvaluation } from "./jar";

/** services/exercise_learning_readiness.readiness, as the ledger carries it. */
const READINESS = {
  label_spec_version: "exercise-adequacy-label-v2",
  readiness_version: "exercise-learning-readiness-v1",
  signal_rules_version: "signal-rules-v3",
  noise_gate_version: "noise-gate-off",
  bar: { min_counted: 300, min_per_exercise: 30 },
  exposures: 41,
  cohort: 20,
  counted: 12,
  attempt_rate: 0.6,
  excluded: { untraced: 3, fallback: 2, repeat: 0, no_attempt: 4, a_reason_added_later: 1 },
  counted_by_selection_mode: { top: 8, coach_chosen: 4 },
  exercises: [
    { exercise_id: "room-to-follow", exposures: 2, cohort: 1, counted: 0, needed: 30 },
    { exercise_id: "land-the-last-word", exposures: 9, cohort: 5, counted: 3, needed: 30 },
    { exposures: 1 },
  ],
  ready: false,
  why_not: "12 of 300 first-exposure attempts with a valid endpoint",
  unavailable: [],
  // An outcome the jar must never read, even if a payload carried one.
  helped: 7,
};

describe("mapExerciseJar", () => {
  it("maps the counts, each exercise against its 30, and why it is not ready", () => {
    const jar = mapExerciseJar(READINESS);
    expect(jar).not.toBeNull();
    expect(jar?.bar).toEqual({ minCounted: 300, minPerExercise: 30 });
    expect([jar?.exposures, jar?.cohort, jar?.counted, jar?.attemptRate]).toEqual([41, 20, 12, 0.6]);
    expect(jar?.exercises).toEqual([
      { exerciseId: "room-to-follow", exposures: 2, cohort: 1, counted: 0, needed: 30 },
      { exerciseId: "land-the-last-word", exposures: 9, cohort: 5, counted: 3, needed: 30 },
    ]);
    expect(jar?.whyNot).toBe("12 of 300 first-exposure attempts with a valid endpoint");
    expect(jar?.countedBySelectionMode).toEqual({ top: 8, coach_chosen: 4 });
    expect(JSON.stringify(jar)).not.toContain("helped");
  });

  it("keeps every reason with a render behind it, the backend's order first, then a new one", () => {
    expect(mapExerciseJar(READINESS)?.excluded).toEqual([
      { reason: "untraced", renders: 3 },
      { reason: "fallback", renders: 2 },
      { reason: "no_attempt", renders: 4 },
      { reason: "a_reason_added_later", renders: 1 },
    ]);
  });

  it("an unreadable source is unknown, never zero", () => {
    const jar = mapExerciseJar({ ...READINESS, counted: 0, unavailable: ["attempts", "not_a_source"] });
    expect(jar?.unavailable).toEqual(["attempts"]);
    expect(jarCount(0, "attempts", jar?.unavailable ?? [])).toBeNull();
    expect(jarCount(41, "exposures", jar?.unavailable ?? [])).toBe(41);
  });

  it("is null when the ledger carries no jar", () => {
    expect(mapExerciseJar(undefined)).toBeNull();
    expect(mapExerciseJar(null)).toBeNull();
    expect(mapExerciseJar([])).toBeNull();
    expect(mapExerciseJar({})).toBeNull();
  });
});

const PILE = {
  scoreboard: {
    counted: 30, helped: 12, helped_rate: 0.4,
    exercises: [{ exercise_id: "land-the-last-word", counted: 30, helped: 12, helped_rate: 0.4 }],
    by_selection_mode: { top: { counted: 30, helped: 12, helped_rate: 0.4 } },
  },
  candidate: {
    version: "exercise-success-ranked-v1",
    learned_from: { labels: 20, speakers: 9 },
    preferences: [{ exercise_id: "land-the-last-word", counted: 20, helped: 8, helped_rate: 0.4, trusted: false }],
  },
  fair_test: {
    holdout: { exposures: 10, speakers: 4, candidate_agrees: 6 },
    candidate: { attempt_rate: 0.7, success_rate: 0.5 },
    baseline: { attempt_rate: 0.6, success_rate: 0.4 },
    success_gain: 0.1, success_gain_interval_95: [-0.05, 0.25], attempt_rate_change: 0.1,
    meets_bar: false, why_not: ["the interval crosses zero"], requires_founder_approval: true,
  },
};

describe("mapJarEvaluation", () => {
  it("is null until the backend serves it", () => {
    expect(mapJarEvaluation(undefined)).toBeNull();
    expect(mapJarEvaluation(null)).toBeNull();
  });

  it("sealed, and why; anything but an explicit false reads as sealed", () => {
    const sealed = mapJarEvaluation({ sealed: true, why_not: "12 of 300 counted", promotes: false });
    expect(sealed).toMatchObject({ sealed: true, whyNot: "12 of 300 counted", piles: null, promotes: false });
    expect(mapJarEvaluation({ machine_only: PILE })?.sealed).toBe(true);
    expect(mapJarEvaluation({ machine_only: PILE })?.piles).toBeNull();
  });

  it("unsealed: two piles that never mix", () => {
    const evaluation = mapJarEvaluation({
      sealed: false, why_not: null, promotes: false, requires_founder_approval: true,
      evaluation_version: "exercise-jar-evaluation-v1", candidate_version: "exercise-success-ranked-v1",
      fair_test_version: "fair-v1", scorekeeper_version: "score-v1",
      machine_only: PILE, with_coach_picks: { ...PILE, scoreboard: { ...PILE.scoreboard, counted: 34 } },
      coach_pick_labels: 4,
    });
    expect(evaluation?.piles?.machine_only.scoreboard.counted).toBe(30);
    expect(evaluation?.piles?.with_coach_picks.scoreboard.counted).toBe(34);
    expect(evaluation?.piles?.machine_only.fairTest).toMatchObject({
      meetsBar: false, whyNot: ["the interval crosses zero"], successGainInterval95: [-0.05, 0.25],
      holdout: { exposures: 10, speakers: 4, candidateAgrees: 6 },
    });
    expect(evaluation?.coachPickLabels).toBe(4);
    expect(evaluation?.requiresFounderApproval).toBe(true);
  });
});
