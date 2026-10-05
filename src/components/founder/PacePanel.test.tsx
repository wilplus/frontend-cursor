// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PacePanel from "./PacePanel";

/* The pace panel reads one route and draws a jar per row, the doors as the
 * constants say them, and the stored weeks with a READY cue's draft; a 403
 * draws "Not available" and no number. Founder-only page (AC-9 for
 * everyone else); the numbers are about the machine. */

const LEDGER = {
  ledger: {
    doors: { consent: { open: false }, dataset_release: { open: false }, training: { open: false }, promotion: { open: false } },
    unavailable: [],
  },
  weeks: [
    {
      week_start: "2026-09-28",
      ready_cues: ["hedging"],
      migration_drafts: { hedging: { file: "migrations/hedging_is_detected.sql", manifest_line: "hedging_is_detected.sql", sql: "UPDATE public.speaking_error …" } },
      exported: [{ surface: "praise_line", exported: 0, why: "door 2 closed" }],
      updated_at: "2026-09-28T06:00:00Z",
    },
  ],
  pace: [
    { jar: "pairs.praise_line", current: 12, bar: 200, observed_rate: 4, weeks_to_bar: 47 },
    { jar: "shadow_cues.hedging", current: 31, bar: 30, observed_rate: 2, weeks_to_bar: 0, caught_rate: 0.85, caught_bar: 0.8, ready: true },
  ],
};

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("PacePanel", () => {
  let root: Root;
  let host: HTMLElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it("draws the jars, the doors and the stored week with its draft", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(200, LEDGER)));
    await act(async () => {
      root.render(<PacePanel />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const text = host.textContent ?? "";
    expect(text).toContain("Praise lines (pairs)");
    expect(text).toContain("12 / 200");
    expect(text).toContain("4 a week → about 47 weeks to the bar");
    expect(text).toContain("Cue “hedging” named by a coach");
    expect(text).toContain("READY");
    expect(text).toContain("at the bar");
    expect(text).toContain("Door 1 · the training yes (consent)");
    expect(text).toContain("week of 2026-09-28");
    expect(text).toContain("migration drafted: migrations/hedging_is_detected.sql");
    expect(text).toContain("door 2 closed");
    expect(host.querySelectorAll('[role="meter"]').length).toBe(2);
    expect(host.querySelectorAll('input[type="range"]').length).toBe(1);
  });

  it("draws no jar while the ledger carries none (nothing new before the field exists)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(200, LEDGER)));
    await act(async () => {
      root.render(<PacePanel />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(host.querySelector('[data-testid="pace-jar"]')).toBeNull();
    expect(host.textContent).not.toContain("The jar");
  });

  it("says Not available on a refusal and draws no number", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(403, { code: "FORBIDDEN", error: "Not available" })));
    await act(async () => {
      root.render(<PacePanel />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const text = host.textContent ?? "";
    expect(text).toContain("Not available for this account.");
    expect(host.querySelectorAll('[role="meter"]').length).toBe(0);
  });
});

/* The jar on the pace panel (founder 2026-09-30, B8, C9; E9). The per-exercise
 * counts come from the ledger's own `exercise_jar`; the evaluation from the
 * route's `jar_evaluation`, drawn only once the backend serves it. */

const JAR = {
  bar: { min_counted: 300, min_per_exercise: 30 },
  exposures: 41, cohort: 20, counted: 12, attempt_rate: 0.6,
  excluded: { untraced: 3, fallback: 2 },
  counted_by_selection_mode: { top: 8, coach_chosen: 4 },
  exercises: [
    { exercise_id: "room-to-follow", exposures: 2, cohort: 1, counted: 0, needed: 30 },
    { exercise_id: "coach-request-req-9", exposures: 9, cohort: 5, counted: 3, needed: 30 },
  ],
  ready: false,
  why_not: "12 of 300 first-exposure attempts with a valid endpoint",
  unavailable: [],
  signal_rules_version: "signal-rules-v3", noise_gate_version: "noise-gate-off", label_spec_version: "exercise-adequacy-label-v2",
};

const LIBRARY = {
  exercises: [{ exercise_id: "coach-request-req-9", title: "Land the last word", instruction: "x", acoustic_problem_tags: [], active: true, version: 1 }],
  speaking_errors: [],
};

const UNSEALED_PILE = {
  scoreboard: {
    counted: 300, helped: 120, helped_rate: 0.4,
    exercises: [{ exercise_id: "coach-request-req-9", counted: 30, helped: 12, helped_rate: 0.4 }],
    by_selection_mode: { top: { counted: 300, helped: 120, helped_rate: 0.4 } },
  },
  candidate: { version: "exercise-success-ranked-v1", learned_from: { labels: 200, speakers: 40 }, preferences: [] },
  fair_test: {
    holdout: { exposures: 100, speakers: 20, candidate_agrees: 60 },
    candidate: { attempt_rate: 0.7, success_rate: 0.5 }, baseline: { attempt_rate: 0.6, success_rate: 0.4 },
    success_gain: 0.1, success_gain_interval_95: [0.02, 0.18], attempt_rate_change: 0.1,
    meets_bar: false, why_not: ["five points are needed"],
  },
};

describe("PacePanel · the jar", () => {
  let root: Root;
  let host: HTMLElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  async function mount(body: unknown): Promise<string> {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      String(url).includes("/api/v2/coach/exercises") ? reply(200, LIBRARY) : reply(200, body)));
    await act(async () => {
      root.render(<PacePanel />);
    });
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    return host.textContent ?? "";
  }

  const withJar = (extra: Record<string, unknown> = {}) => ({
    ...LEDGER, ledger: { ...LEDGER.ledger, exercise_jar: JAR }, ...extra,
  });

  it("draws the jar and every exercise against its 30, by title where the library has one", async () => {
    const text = await mount(withJar());
    expect(text).toContain("The jar");
    expect(text).toContain("12 of 300 counted");
    expect(text).toContain("12 of 300 first-exposure attempts with a valid endpoint");
    const rows = [...host.querySelectorAll('[data-testid="pace-jar-exercises"] tbody tr')].map((r) => r.textContent ?? "");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("room-to-follow");
    expect(rows[0]).toContain("0 / 30");
    expect(rows[1]).toContain("Land the last word");
    expect(rows[1]).toContain("3 / 30");
    expect(text).toContain("Chosen by a coach");
    expect(text).toContain("A general exercise or the warm-up, served because nothing targeted what fired");
  });

  it("draws no evaluation until the backend serves it, and no outcome word on the jar", async () => {
    const text = await mount(withJar());
    expect(host.querySelector('[data-testid="pace-jar-evaluation"]')).toBeNull();
    expect(text).not.toMatch(/helped/i);
  });

  it("a sealed evaluation says only why", async () => {
    const text = await mount(withJar({
      jar_evaluation: { sealed: true, why_not: "12 of 300 first-exposure attempts with a valid endpoint", promotes: false },
    }));
    const section = host.querySelector('[data-testid="pace-jar-evaluation"]')?.textContent ?? "";
    expect(section).toContain("Sealed until the bar is met: 12 of 300 first-exposure attempts with a valid endpoint.");
    expect(text).not.toMatch(/helped/i);
    expect(host.querySelectorAll('[role="tab"]').length).toBe(0);
  });

  it("an unsealed evaluation draws the two piles, the scoreboard and the fair test", async () => {
    await mount(withJar({
      jar_evaluation: {
        sealed: false, why_not: null, promotes: false, requires_founder_approval: true,
        evaluation_version: "exercise-jar-evaluation-v1", candidate_version: "exercise-success-ranked-v1",
        fair_test_version: "fair-v1", machine_only: UNSEALED_PILE, with_coach_picks: UNSEALED_PILE, coach_pick_labels: 0,
      },
    }));
    const section = host.querySelector('[data-testid="pace-jar-evaluation"]')?.textContent ?? "";
    expect([...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(["Machine picks only", "With coach picks"]);
    expect(section).toContain("120 of 300 helped");
    expect(section).toContain("Land the last word");
    expect(section).toContain("+10 pts");
    expect(section).toContain("Does not meet the bar: five points are needed");
    expect(section).toContain("Nothing is promoted by this page");
  });
});
