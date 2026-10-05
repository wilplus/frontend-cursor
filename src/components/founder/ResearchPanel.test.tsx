// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResearchPanel from "./ResearchPanel";

/* The research screen's panels carry the backend's data (ML-7, ML DONE
 * "the research screen shows ... drift"): a dataset shows its drafts shown,
 * its consent-authorised share and the splits its releases assigned; Drift
 * draws the weekly PSI 2x2 most urgent first; Monitors draws the readiness
 * check read now. A panel with nothing to show keeps its note in words.
 * Research role and founder only; numbers about the machine, no person. */

const OVERVIEW = {
  view_version: "research-view-v1",
  datasets: {
    praise_line: {
      pairs: 8, exposures: 11, unexported: 2, releasable: 6, consent_authorised_share: 0.75,
      consent_note: null, releases: [{ week_start: "2026-10-12", item_count: 6, voided_at: null }],
      splits: { train: 6, validation: 1, test: 2 }, splits_note: null,
    },
    exercise_script: {
      pairs: 0, exposures: 3, unexported: 0, releasable: 0, consent_authorised_share: null,
      consent_note: "no pair on this surface yet", releases: [], splits: null,
      splits_note: "no release yet: splits are assigned at release (80/10/10, speaker-disjoint)",
    },
  },
  labels: { labels: 0, moments: 0, moments_with_two_humans: 0, kappa: null, kappa_from: 0 },
  exclusions: { by_reason: {}, note: "no release yet, so no exclusion was decided" },
  exports: { annotation_runs: [], pair_exports: [], note: null },
  evaluations: { reports: [], note: "door 3 closed" },
  training: { runs: [], note: "no fine-tune has run" },
  promotions: [],
  promotion_history: [],
  drift: {
    week_start: "2026-10-05", worst: "PIPELINE_CHANGED", note: null, minted: 0,
    dimensions: [
      { dimension: "wpm", triage: "PIPELINE_CHANGED", psi: 0.04, psi_band: "STABLE", chart_signal: "OUT_OF_CONTROL_HIGH", n_sessions: 60 },
      { dimension: "fillers", triage: "HEALTHY", psi: 0.02, psi_band: "STABLE", chart_signal: "IN_CONTROL", n_sessions: 58 },
    ],
  },
  monitors: {
    confidence_canary: {
      ready: false, blocker_codes: ["confidence_ring_row_killed"], warning_codes: ["no_runtime_canary_receipt_yet"],
      cutover_mode: "founder_canary", read_at: "2026-10-12T06:00:00+00:00",
    },
    note: "read now from the database",
  },
  golden: {},
  weekly: [],
  doors: {},
  unavailable: [],
};

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function route(overview: unknown) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/v2/research/overview")) return reply(200, overview);
    return reply(200, {});
  });
}

describe("ResearchPanel", () => {
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

  async function draw(overview: unknown) {
    vi.stubGlobal("fetch", route(overview));
    await act(async () => {
      root.render(<ResearchPanel founder={false} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    return host.textContent ?? "";
  }

  it("draws the share, the splits, the drift 2x2 and the monitor", async () => {
    const text = await draw(OVERVIEW);
    expect(text).toContain("8 pairs · 11 drafts shown · 2 unexported · 1 releases");
    expect(text).toContain("consent-authorised: 75%");
    expect(text).toContain("splits: train 6 · validation 1 · test 2");
    expect(text).toContain("no pair on this surface yet");
    expect(text).toContain("week of 2026-10-05 · most urgent: PIPELINE_CHANGED");
    expect(text).toContain("OUT_OF_CONTROL_HIGH");
    expect(text).toContain("STABLE · 0.040");
    expect(text).toContain("Confidence readiness · founder_canary");
    expect(text).toContain("blocked");
    expect(text).toContain("blockers: confidence_ring_row_killed");
    expect(text).toContain("read 2026-10-12 06:00 UTC");
    const rows = Array.from(host.querySelectorAll("tbody tr")).map((tr) => tr.textContent ?? "");
    expect(rows[0]).toContain("wpm");
    expect(rows[1]).toContain("fillers");
  });

  it("keeps the words when no week carries a drift reading and the monitor was unreadable", async () => {
    const text = await draw({
      ...OVERVIEW,
      drift: { week_start: null, worst: null, dimensions: [], note: "no stored week carries a drift reading yet" },
      monitors: { confidence_canary: null, note: "the readiness monitor could not be read now" },
      unavailable: ["monitors"],
    });
    expect(text).toContain("no stored week carries a drift reading yet");
    expect(text).toContain("the readiness monitor could not be read now");
    expect(text).not.toContain("Confidence readiness ·");
    expect(text).toContain("unavailable this read: monitors");
  });
});
