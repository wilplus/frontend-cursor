// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The jar (founder 2026-09-29, decision 5). Pinned here:                    */
/*    1. the mapper reads counts and the per-exercise bar, nothing else;      */
/*    2. a source the backend could not read shows "Unknown", never 0, and    */
/*       the page still renders the bar;                                      */
/*    3. no field named help, helped, success or outcome is read from the     */
/*       JSON, and none of those words reaches the screen (the scorekeeper's  */
/*       seal);                                                               */
/*    4. the selection modes and the exclusions read as plain sentences.      */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mapExerciseJar } from "@/services/api/journalAdmin";
import { ExerciseJarView, JAR_COPY, jarCount } from "./ExerciseJar";

const RAW = {
  label_spec_version: "exercise-adequacy-label-v1",
  readiness_version: "exercise-learning-readiness-v1",
  signal_rules_version: "cv-exercise-signals-v1",
  noise_gate_version: "noise-gate-v1:off",
  bar: { min_counted: 300, min_per_exercise: 30 },
  exposures: 41,
  cohort: 20,
  counted: 12,
  attempt_rate: 0.6,
  excluded: { untraced: 3, no_targeted_problem: 0, rules_changed: 0, repeat: 18,
              below_minimum_probability: 0, no_attempt: 7, no_valid_attempt: 1 },
  counted_by_selection_mode: { top: 9, exploration: 2, coach_chosen: 1 },
  exercises: [
    { exercise_id: "room", exposures: 30, cohort: 14, counted: 9, needed: 30 },
    { exercise_id: "slow", exposures: 11, cohort: 6, counted: 3, needed: 30 },
  ],
  ready: false,
  why_not: "12 of 300 first-exposure attempts with a valid endpoint",
  unavailable: [],
  // Never read. A future backend field about outcomes must not leak in here.
  helped: 5,
  success_rate: 0.9,
};

describe("the jar's mapper", () => {
  it("reads the counts and the bar", () => {
    const jar = mapExerciseJar(RAW);
    expect(jar.counted).toBe(12);
    expect(jar.bar).toEqual({ minCounted: 300, minPerExercise: 30 });
    expect(jar.attemptRate).toBe(0.6);
    expect(jar.exercises.map((e) => e.exerciseId)).toEqual(["room", "slow"]);
    expect(jar.exercises[0]).toEqual({ exerciseId: "room", exposures: 30, cohort: 14, counted: 9, needed: 30 });
    expect(jar.countedBySelectionMode).toEqual({ top: 9, exploration: 2, coach_chosen: 1 });
    expect(jar.excluded.repeat).toBe(18);
    expect(jar.ready).toBe(false);
    expect(jar.whyNot).toBe("12 of 300 first-exposure attempts with a valid endpoint");
  });

  it("reads no outcome field, whatever the backend sends", () => {
    const jar = mapExerciseJar(RAW) as unknown as Record<string, unknown>;
    const keys = JSON.stringify(Object.keys(jar)).toLowerCase();
    for (const word of ["help", "success", "outcome", "score"]) {
      expect(keys).not.toContain(word);
    }
    const mapper = readFileSync(resolve(process.cwd(), "src/services/api/journalAdmin.ts"), "utf8");
    const jarMapper = mapper.slice(mapper.indexOf("export function mapExerciseJar"));
    for (const word of ["helped", "success", "outcome"]) {
      expect(jarMapper).not.toContain(word);
    }
    // Every sentence on the screen, and none of them reads as a result.
    for (const value of Object.values(JAR_COPY)) {
      const words = typeof value === "string" ? value
        : typeof value === "function" ? "" : Object.values(value).join(" ");
      expect(words.toLowerCase()).not.toMatch(/\b(helped|success|outcome)\b/);
    }
  });

  it("keeps an unreadable source unknown, not zero", () => {
    const jar = mapExerciseJar({ ...RAW, counted: 0, ready: false, unavailable: ["attempts", "nonsense"],
                                 why_not: "unreadable: attempts" });
    expect(jar.unavailable).toEqual(["attempts"]);
    expect(jarCount(jar.counted, "attempts", jar.unavailable)).toBe(JAR_COPY.unknown);
    expect(jarCount(jar.exposures, "exposures", jar.unavailable)).toBe("41");
  });

  it("tolerates an empty answer", () => {
    const jar = mapExerciseJar(null);
    expect(jar.counted).toBe(0);
    expect(jar.bar.minCounted).toBe(300);
    expect(jar.exercises).toEqual([]);
    expect(jar.attemptRate).toBeNull();
  });
});

describe("the jar page", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const TITLES = new Map([["room", "Fill the room"]]);

  function mount(raw: Record<string, unknown>) {
    act(() => root.render(createElement(ExerciseJarView, { jar: mapExerciseJar(raw), titles: TITLES })));
    return container.textContent ?? "";
  }

  it("renders the bar, the per-exercise counts and the plain reasons", () => {
    const text = mount(RAW);
    expect(text).toContain("12 of 300 counted");
    expect(text).toContain("Fill the room");
    expect(text).toContain("9 / 30");
    expect(text).toContain(JAR_COPY.mode.coach_chosen);
    expect(text).toContain(JAR_COPY.exclusion.repeat);
    expect(text).toContain("12 of 300 first-exposure attempts with a valid endpoint");
    expect(text.toLowerCase()).not.toContain("helped");
    expect(text.toLowerCase()).not.toContain("success");
  });

  it("says which source could not be read and still shows the bar", () => {
    const text = mount({ ...RAW, unavailable: ["attempts"], ready: false, why_not: "unreadable: attempts" });
    expect(text).toContain("Couldn’t read attempts.");
    expect(text).toContain(`${JAR_COPY.unknown} of 300 counted`);
    expect(text).toContain("unreadable: attempts");
  });
});
