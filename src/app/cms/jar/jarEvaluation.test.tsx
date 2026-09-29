// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The evaluation on the jar page (founder 2026-09-29, evening: a full jar   */
/*  unseals the evaluation by itself; coach picks in, in their own pile).     */
/*  Pinned here:                                                              */
/*    1. the mapper fails closed: anything but an explicit `sealed: false`   */
/*       is sealed, and a sealed answer carries no pile;                      */
/*    2. sealed renders one sentence with the counter's reason and no rate;   */
/*    3. unsealed renders both piles behind a toggle, machine picks first,    */
/*       with the scoreboard and the fair test, and says nothing promotes;    */
/*    4. the jar's own mapper and copy stay free of outcome words (the other  */
/*       test file); this one is where those words live.                      */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mapJarEvaluation } from "@/services/api/journalAdmin";
import { EVALUATION_COPY, EvaluationView } from "./ExerciseJar";

const PILE = {
  scoreboard: {
    counted: 310, helped: 155, helped_rate: 0.5,
    exercises: [
      { exercise_id: "room", counted: 200, helped: 120, helped_rate: 0.6 },
      { exercise_id: "slow", counted: 110, helped: 35, helped_rate: 0.3182 },
    ],
    by_selection_mode: { top: { counted: 250, helped: 130, helped_rate: 0.52 },
                         exploration: { counted: 60, helped: 25, helped_rate: 0.4167 } },
  },
  candidate: {
    version: "exercise-success-ranked-v1",
    learned_from: { labels: 217, speakers: 40 },
    preferences: [
      { exercise_id: "room", counted: 140, helped: 84, helped_rate: 0.6, trusted: true },
      { exercise_id: "slow", counted: 20, helped: 6, helped_rate: 0.3, trusted: false },
    ],
  },
  fair_test: {
    meets_bar: false,
    why_not: ["interval of the gain not above zero"],
    holdout: { exposures: 93, speakers: 17, candidate_agrees: 70 },
    candidate: { attempt_rate: 0.7, success_rate: 0.58 },
    baseline: { attempt_rate: 0.71, success_rate: 0.5 },
    success_gain: 0.08,
    success_gain_interval_95: [-0.01, 0.17],
    attempt_rate_change: -0.01,
    requires_founder_approval: true,
  },
};

const UNSEALED = {
  evaluation_version: "exercise-jar-evaluation-v1",
  candidate_version: "exercise-success-ranked-v1",
  fair_test_version: "exercise-fair-test-v1",
  scorekeeper_version: "exercise-adequacy-scorekeeper-v1",
  sealed: false,
  why_not: null,
  requires_founder_approval: true,
  promotes: false,
  machine_only: PILE,
  with_coach_picks: {
    ...PILE,
    scoreboard: { ...PILE.scoreboard, counted: 330, helped: 170,
                  by_selection_mode: { ...PILE.scoreboard.by_selection_mode,
                                       coach_chosen: { counted: 20, helped: 15, helped_rate: 0.75 } } },
  },
  coach_pick_labels: 20,
};

describe("the evaluation's mapper", () => {
  it("fails closed: only an explicit sealed:false unseals, and sealed carries no pile", () => {
    expect(mapJarEvaluation({}).sealed).toBe(true);
    expect(mapJarEvaluation({ sealed: "no" }).sealed).toBe(true);
    const sealed = mapJarEvaluation({ sealed: true, why_not: "12 of 300 first-exposure attempts with a valid endpoint", machine_only: PILE });
    expect(sealed.piles).toBeNull();
    expect(sealed.whyNot).toContain("12 of 300");
    expect(sealed.requiresFounderApproval).toBe(true);
    expect(sealed.promotes).toBe(false);
  });

  it("reads both piles and the fair test when unsealed", () => {
    const out = mapJarEvaluation(UNSEALED);
    expect(out.sealed).toBe(false);
    expect(out.piles?.machine_only.scoreboard.exercises.map((e) => e.exerciseId)).toEqual(["room", "slow"]);
    expect(out.piles?.with_coach_picks.scoreboard.bySelectionMode.coach_chosen?.counted).toBe(20);
    expect(out.piles?.machine_only.scoreboard.bySelectionMode.coach_chosen).toBeUndefined();
    expect(out.piles?.machine_only.fairTest.successGainInterval95).toEqual([-0.01, 0.17]);
    expect(out.piles?.machine_only.fairTest.meetsBar).toBe(false);
    expect(out.piles?.machine_only.candidate.preferences[1]?.trusted).toBe(false);
    expect(out.coachPickLabels).toBe(20);
  });

  it("still needs the founder when the backend forgets to say so", () => {
    const out = mapJarEvaluation({ ...UNSEALED, requires_founder_approval: undefined,
      machine_only: { ...PILE, fair_test: { ...PILE.fair_test, requires_founder_approval: undefined } } });
    expect(out.requiresFounderApproval).toBe(true);
    expect(out.piles?.machine_only.fairTest.requiresFounderApproval).toBe(true);
  });
});

describe("the evaluation rendered", () => {
  let host: HTMLDivElement;
  let root: Root;
  const titles = new Map([["room", "Give the room a second"], ["slow", "Slow the ending"]]);

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function render(raw: unknown) {
    act(() => {
      root.render(createElement(EvaluationView, { evaluation: mapJarEvaluation(raw), titles }));
    });
  }
  const text = () => host.textContent ?? "";

  it("sealed: one sentence with the reason, and no rate on the screen", () => {
    render({ sealed: true, why_not: "12 of 300 first-exposure attempts with a valid endpoint" });
    expect(text()).toContain("Sealed until the bar is met: 12 of 300");
    expect(text()).not.toContain("%");
    expect(host.querySelector("table")).toBeNull();
  });

  it("unsealed: machine picks first, both piles behind the toggle, nothing promoted", () => {
    render(UNSEALED);
    expect(text()).toContain(EVALUATION_COPY.unsealed);
    expect(text()).toContain("Nothing is promoted");
    expect(text()).toContain("Give the room a second");
    expect(text()).toContain("155 of 310 helped");
    expect(text()).toContain("+8 pts");
    expect(text()).toContain("interval of the gain not above zero");
    expect(text()).not.toContain("Chosen by a coach");
    const tabs = [...host.querySelectorAll('[role="tab"]')] as HTMLButtonElement[];
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    act(() => tabs[1]!.click());
    expect(text()).toContain("170 of 330 helped");
    expect(text()).toContain("Chosen by a coach");
    expect(text()).toContain("15 / 20");
  });
});
