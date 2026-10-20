// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  STORY    As a speaker in the Lounge, I want the AI version of my voice to */
/*           appear with its bubble, not after another wait, so that the chat */
/*           feels immediate.                                                 */
/*  OUTCOME                                                                   */
/*    O1  When the page already asked for the clip, the bubble's first render */
/*        has the player on that clip and the "why" line, and no second       */
/*        request goes out.                                                   */
/*    O2  A clip still being made comes in when it lands; one that never      */
/*        comes shows the step's plain words (founder 2026-10-20).            */
/*  PROVES   O1 -> "draws the player and the why with the bubble when the     */
/*                  page already asked for the clip"                          */
/*           O2 -> "a clip still being made comes in when it lands, and one   */
/*                  that never comes shows the plain words"                   */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LoungeAiVoiceBubble from "./LoungeAiVoiceBubble";
import { WALK_COPY } from "./idealEditCopy";
import { readAiVoiceOnce } from "@/services/api/aiVoice";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const outcomeCall = vi.hoisted(() =>
  vi.fn(async (_path: string, _init: unknown, map: (d: Record<string, unknown>) => unknown) => ({
    ok: true,
    data: map({ demo: "ai_voice", clip: { state: "ready", url: "blob:ai", duration_ms: 3000, why: "It slows on March." } }),
  })),
);
vi.mock("@/lib/api/bffCall", () => ({ outcomeCall }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("draws the player and the why with the bubble when the page already asked for the clip", async () => {
  // The walk's host asks as its AI bubble is shown.
  await readAiVoiceOnce("pr-1");
  expect(outcomeCall).toHaveBeenCalledTimes(1);
  // A synchronous render: no effect or promise has run yet.
  act(() => root.render(<LoungeAiVoiceBubble body="A line." practiceId="pr-1" then={null} seed="m1" avatar={null} />));
  expect(host.querySelector(`button[aria-label="Play ${WALK_COPY.aiVoiceLabel}"]`)).not.toBeNull();
  expect(host.querySelector("audio")?.getAttribute("src")).toBe("blob:ai");
  expect(host.querySelector("[data-lounge-ai-why]")?.textContent).toBe("It slows on March.");
  await act(async () => {
    await Promise.resolve();
  });
  expect(outcomeCall).toHaveBeenCalledTimes(1);
});

it("a clip still being made comes in when it lands, and one that never comes shows the plain words", async () => {
  vi.useFakeTimers();
  try {
    const answer = (state: string, url: string | null) => async (_p: string, _i: unknown, map: (d: Record<string, unknown>) => unknown) => ({
      ok: true,
      data: map({ demo: "ai_voice", clip: { state, url, duration_ms: 3000, why: null } }),
    });
    // Still being made, then ready: the player comes in without a reload.
    outcomeCall.mockImplementationOnce(answer("pending", null)).mockImplementationOnce(answer("ready", "blob:late"));
    act(() => root.render(<LoungeAiVoiceBubble body="A line." practiceId="pr-2" then={null} fallback="Exercise\nSay it again." seed="m2" avatar={null} />));
    await act(async () => {
      await Promise.resolve();
    });
    expect(host.querySelector("audio")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(host.querySelector("audio")?.getAttribute("src")).toBe("blob:late");
    // Never comes: the step's plain words instead of the AI lines.
    outcomeCall.mockImplementationOnce(answer("unavailable", null));
    act(() => root.render(<LoungeAiVoiceBubble body="A line." practiceId="pr-3" then={null} fallback="Exercise\nSay it again." seed="m3" avatar={null} />));
    await act(async () => {
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Say it again.");
    expect(host.textContent).not.toContain("A line.");
    expect(host.textContent).not.toContain(WALK_COPY.aiVoiceLabel);
  } finally {
    vi.useRealTimers();
  }
});
