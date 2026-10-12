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
import { mapGoldenCounts } from "@/services/api/founderLearning";

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
});
