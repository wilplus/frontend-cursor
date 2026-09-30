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
