// @vitest-environment jsdom
/*
 * STORY    As the founder, I want to judge golden pairs seeing the passage
 *          and the coach's final only, so that the golden set measures real
 *          answers.
 * OUTCOME
 *   O1  A pair shows the passage and the coach's final, no draft, and sends
 *       one of three answers.
 *   O2  A clip surface keeps the coach's instrument, not the pair question.
 *   O3  A sealed set that erasure changed says so and lets me judge again;
 *       an intact sealed set offers no more judging.
 * PROVES   O1 -> "shows the passage and the coach's final, never a draft, ..."
 *          O2 -> "a clip surface judges on the coach's instrument"
 *          O3 -> "a sealed set erasure changed says so and opens judging again"
 * WHY      ML-10: the golden set replaces the engineering seeds.
 */
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

  it("a clip surface judges on the coach's instrument", async () => {
    api.nextMoment.mockResolvedValue({ ok: true, value: {
      snippetId: "clip-1", takeSessionId: "t1", passage: "and that is why we left",
      final: null, audioUrl: "https://x/clip.webm", startOffsetMs: 100, durationMs: 2000,
    } });
    act(() => root.render(createElement(GoldenJudging, {
      surface: "pace", counts: counts({ surface: "pace", kind: "clip" }), onChange: vi.fn(),
    })));
    await act(async () => button("Continue judging")?.click());
    await flush();
    expect(container.querySelector('[data-testid="clip-instrument"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Is this the right answer for this passage?");
  });

  it("a sealed set erasure changed says so and opens judging again", async () => {
    const sealed = { count: 50, sha256: "abc", sealed_at: "2026-10-01T00:00:00Z" };
    act(() => root.render(createElement(GoldenJudging, {
      surface: "praise_line", counts: counts({ count: 49, sealed, sealedIntact: true }), onChange: vi.fn(),
    })));
    expect(container.textContent).toContain("sha256 abc");
    expect(button("Continue judging")).toBeUndefined();

    act(() => root.render(createElement(GoldenJudging, {
      surface: "praise_line", counts: counts({ count: 49, sealed, sealedIntact: false }), onChange: vi.fn(),
    })));
    expect(container.textContent).toContain("Erasure removed a moment from the sealed set.");
    expect(button("Continue judging")).toBeDefined();
  });
});
