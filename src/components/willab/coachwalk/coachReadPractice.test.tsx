// @vitest-environment jsdom
/* The coach's judgement of a practice recording comes back (founder
 * 2026-10-05, Q6). Pins: the Read maps the speaker's chosen recording and
 * the coach's own saved answer; Read draws the one instrument under
 * "<speaker>'s practice" only when there is one; a tap saves through the
 * practice-judgement route, and a refusal keeps the sentence. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CoachReadSheet from "./CoachReadSheet";
import { mapMomentRead } from "@/services/api/coachWalk";

const pager = { index: 0, total: 1, label: "Quiet Heron", onBack: () => {}, onNext: () => {} };

function readPayload(practice: unknown) {
  return {
    passage: "We, we rebuilt it.",
    speaker_answer: "yes",
    coach_answer: "no",
    speaker_goal: null,
    request: null,
    practice,
  };
}

const PRACTICE = { attempt_id: "att-2", audio_ref: "https://media/a2.webm", duration_ms: 3200, coach_answer: null };

describe("mapMomentRead · practice", () => {
  it("maps the chosen recording and the coach's own answer", () => {
    expect(mapMomentRead(readPayload({ ...PRACTICE, coach_answer: "in_between" }))?.practice).toEqual({
      attemptId: "att-2", audioRef: "https://media/a2.webm", durationMs: 3200, coachAnswer: "in_between",
    });
  });

  it("is null when there is none", () => {
    expect(mapMomentRead(readPayload(null))?.practice).toBeNull();
    expect(mapMomentRead(readPayload({ audio_ref: "x" }))?.practice).toBeNull();
  });
});

describe("CoachReadSheet · the practice judgement", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function mount(practice: unknown): Promise<void> {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith("/moment")) {
        return new Response(JSON.stringify(readPayload(practice)), { status: 200 });
      }
      return new Response(JSON.stringify({ answer: "yes" }), { status: 200 });
    });
    await act(async () => {
      root.render(createElement(CoachReadSheet, {
        sessionId: "take-1", snippetId: "snip-1", pseudonym: "Quiet Heron", pager,
        coachAnswer: null, onClose: () => {}, onAnswer: () => {}, onNothingToAdd: () => {}, onNext: () => {},
      }));
    });
    await act(async () => { await Promise.resolve(); });
  }

  function click(label: string): void {
    const box = container.querySelector('[data-testid="coach-read-practice"]');
    const button = [...(box?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.trim() === label);
    if (!button) throw new Error(`no button ${label}`);
    act(() => { button.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  }

  it("draws the instrument under the speaker's practice when there is one", async () => {
    await mount(PRACTICE);
    expect(container.textContent).toContain("Quiet Heron’s practice");
    expect(container.querySelector('[data-testid="coach-read-practice"]')).not.toBeNull();
  });

  it("draws nothing when there is no practice", async () => {
    await mount(null);
    expect(container.querySelector('[data-testid="coach-read-practice"]')).toBeNull();
  });

  it("a tap saves through the practice-judgement route", async () => {
    await mount(PRACTICE);
    click("Yes — Confident");
    await act(async () => { await Promise.resolve(); });
    const put = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/practice-judgement"));
    expect(put).toBeDefined();
    expect(put?.[1]).toMatchObject({ method: "PUT", body: JSON.stringify({ answer: "yes" }) });
  });

  it("a refused save keeps the sentence", async () => {
    await mount(PRACTICE);
    fetchMock.mockImplementation(async () => new Response("{}", { status: 409 }));
    click("Not sure");
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toContain("Couldn’t save your answer.");
  });
});
