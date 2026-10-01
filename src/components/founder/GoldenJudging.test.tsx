// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The golden set for a pair surface (ML-10): the founder sees the passage  */
/*  and the coach's final, never a draft, and answers one of three; a clip   */
/*  surface keeps the coach's instrument; a sealed set that erasure changed  */
/*  says so and lets the founder judge again.                                */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  nextMoment: vi.fn(),
  judge: vi.fn(),
  seal: vi.fn(),
}));

vi.mock("@/services/api/founderLearning", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/founderLearning")>();
  return { ...actual, founderLearning: { ...actual.founderLearning, ...api } };
});

vi.mock("@/components/willab/coachwalk/CoachJudgeInstrument", () => ({
  default: () => createElement("div", { "data-testid": "clip-instrument" }),
}));

import GoldenJudging from "./GoldenJudging";
import { mapGoldenCounts, mapGoldenMoment } from "@/services/api/founderLearning";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.nextMoment.mockReset();
  api.judge.mockReset();
  api.seal.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => { await Promise.resolve(); });
const counts = (over: Partial<ReturnType<typeof mapGoldenCounts>> = {}) => ({
  surface: "praise_line", kind: "pair" as const, count: 3, setSize: 50, sealed: null, sealedIntact: null, ...over,
});
const button = (label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === label);

describe("the client mapping", () => {
  it("reads the kind, the final and whether the seal is intact", () => {
    expect(mapGoldenCounts({ surface: "praise_line", kind: "pair", count: 2, set_size: 50, sealed: null })?.kind).toBe("pair");
    expect(mapGoldenCounts({ surface: "confidence", count: 2, set_size: 50, sealed: null })?.kind).toBe("clip");
    expect(mapGoldenCounts({ surface: "praise_line", kind: "pair", count: 49, set_size: 50,
      sealed: { count: 50, sha256: "a", sealed_at: "2026-10-05" }, sealed_intact: false })?.sealedIntact).toBe(false);
    expect(mapGoldenMoment({ snippet_id: "pair-1", passage: "so the figure", final: "you held it" })?.final).toBe("you held it");
    expect(mapGoldenMoment({ snippet_id: "s1", passage: "words" })?.final).toBeNull();
  });
});

describe("judging a pair surface", () => {
  it("shows the passage and the coach's final, never a draft, and sends one of three", async () => {
    api.nextMoment.mockResolvedValue({ ok: true, value: {
      snippetId: "pair-1", takeSessionId: null, passage: "so the figure was about nine million",
      final: "you held the pause before the number", audioUrl: null, startOffsetMs: 0, durationMs: 0,
    } });
    api.judge.mockResolvedValue({ ok: true, value: counts({ count: 4 }) });
    const onChange = vi.fn();
    act(() => root.render(createElement(GoldenJudging, { surface: "praise_line", counts: counts(), onChange })));
    await act(async () => button("Continue judging")?.click());
    await flush();
    expect(container.textContent).toContain("so the figure was about nine million");
    expect(container.textContent).toContain("you held the pause before the number");
    expect(container.textContent).toContain("Is this the right answer for this passage?");
    expect(container.querySelector('[data-testid="clip-instrument"]')).toBeNull();
    expect(container.textContent).not.toMatch(/draft/i);
    await act(async () => button("Not sure")?.click());
    await flush();
    expect(api.judge).toHaveBeenCalledWith("praise_line", { snippet_id: "pair-1", take_session_id: null, value: "not_sure" });
    expect(onChange).toHaveBeenCalled();
  });

  it("keeps the coach's instrument for a clip surface", async () => {
    api.nextMoment.mockResolvedValue({ ok: true, value: {
      snippetId: "s1", takeSessionId: "t1", passage: "words", final: null, audioUrl: "https://r2/x.webm", startOffsetMs: 0, durationMs: 900,
    } });
    act(() => root.render(createElement(GoldenJudging, { surface: "confidence", counts: counts({ surface: "confidence", kind: "clip" }), onChange: () => {} })));
    await act(async () => button("Continue judging")?.click());
    await flush();
    expect(container.querySelector('[data-testid="clip-instrument"]')).not.toBeNull();
  });

  it("a sealed set that erasure changed says so and can be judged again", () => {
    act(() => root.render(createElement(GoldenJudging, {
      surface: "praise_line", onChange: () => {},
      counts: counts({ count: 49, sealed: { count: 50, sha256: "a".repeat(64), sealed_at: "2026-10-05T00:00:00Z" }, sealedIntact: false }),
    })));
    expect(container.textContent).toContain("Erasure removed a moment from the sealed set.");
    expect(button("Continue judging")).toBeDefined();
  });
});
