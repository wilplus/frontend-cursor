// @vitest-environment jsdom
/*
STORY    As a coach, I want my way into the queue to be a row in my list of
         chats, not two buttons fixed at the bottom of Will's chat, and to
         tell me at once, and truly, whether someone waits.
OUTCOME
  O1  No line shows until the queue is read; then "Open your queue" with
      the new look, and no number.
  O2  Coming back shows the remembered state right away.
  O3  "Nobody is waiting for you." shows only when the queue was read empty.
  O4  The row is named by the job in my profile, "Your queue" without one.
  O5  Tapping the row opens Your queue; its last card opens Speakers; Will's
      chat keeps no coach button.
PROVES   O1 -> "shows no line until the queue is read, then Open your queue, new, with no number"
         O2 -> "coming back shows the remembered state right away"
         O3 -> "says nobody is waiting only once the queue was read empty"
         O4 -> "is named by the profile's job, or Your queue"
         O5 -> "the row opens Your queue, and its last card opens Speakers; the door draws nothing of its own"
WHY      Founder 2026-10-18 (never "Nobody" before it knows); backend N521,
         5 November 2026 (the way in is a row in the list of chats).
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMomentsQueue = vi.fn();
vi.mock("@/services/api/coachWalk", async (orig) => ({
  ...(await orig<typeof import("@/services/api/coachWalk")>()),
  fetchMomentsQueue: (...a: unknown[]) => fetchMomentsQueue(...a),
}));
const getMyProfile = vi.fn();
vi.mock("@/services/api/chats", async (orig) => ({
  ...(await orig<typeof import("@/services/api/chats")>()),
  getMyProfile: (...a: unknown[]) => getMyProfile(...a),
}));

import CoachChatRow, { coachRowWords } from "./CoachChatRow";
import CoachWalkEntry from "./CoachWalkEntry";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The list's row over the door, mounted in the Lounge underneath. */
function ListOverLounge() {
  return (
    <>
      <div data-list=""><CoachChatRow /></div>
      <div data-lounge=""><CoachWalkEntry /></div>
    </>
  );
}

const ONE_WAITING = {
  ok: true,
  speakers: [{ pseudonym: "Ash", goal: null, waiting: 2, takes: [] }],
};

let host: HTMLDivElement;
let root: Root;
const row = () => host.querySelector<HTMLButtonElement>('[data-chat-row="coach"]')!;
const line = () => row().querySelector("[data-chat-last]")!.textContent ?? "";

beforeEach(() => {
  window.localStorage.clear();
  fetchMomentsQueue.mockReset();
  getMyProfile.mockReset().mockResolvedValue({ role: null });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("the coach's row in the list of chats", () => {
  it("shows no line until the queue is read, then Open your queue, new, with no number", async () => {
    let resolve: (v: unknown) => void = () => {};
    fetchMomentsQueue.mockReturnValue(new Promise((r) => (resolve = r)));
    await act(async () => root.render(<ListOverLounge />));
    expect(line()).toBe("");
    await act(async () => resolve(ONE_WAITING));
    expect(line()).toBe(COPY.bubbleOpen);
    expect(row().hasAttribute("data-chat-new")).toBe(true);
    expect(row().textContent).not.toMatch(/\d/);
  });

  it("coming back shows the remembered state right away", async () => {
    fetchMomentsQueue.mockResolvedValue(ONE_WAITING);
    await act(async () => root.render(<ListOverLounge />));
    expect(line()).toBe(COPY.bubbleOpen);
    act(() => root.unmount());

    fetchMomentsQueue.mockReturnValue(new Promise(() => {}));
    root = createRoot(host);
    await act(async () => root.render(<ListOverLounge />));
    expect(line()).toBe(COPY.bubbleOpen);
  });

  it("says nobody is waiting only once the queue was read empty", async () => {
    fetchMomentsQueue.mockResolvedValue({ ok: true, speakers: [] });
    await act(async () => root.render(<ListOverLounge />));
    expect(line()).toBe(COPY.queueEmpty);
    expect(row().hasAttribute("data-chat-new")).toBe(false);
  });

  it("is named by the profile's job, or Your queue", async () => {
    expect(coachRowWords("  ", 1).title).toBe(COPY.queueTitle);
    fetchMomentsQueue.mockResolvedValue(ONE_WAITING);
    getMyProfile.mockResolvedValue({ role: "Speaking coach" });
    await act(async () => root.render(<ListOverLounge />));
    expect(row().textContent).toContain("Speaking coach");
  });

  it("the row opens Your queue, and its last card opens Speakers; the door draws nothing of its own", async () => {
    fetchMomentsQueue.mockResolvedValue(ONE_WAITING);
    await act(async () => root.render(<ListOverLounge />));
    expect(host.querySelector("[data-lounge]")!.querySelector("button")).toBeNull();

    await act(async () => row().click());
    expect(document.querySelector("[data-testid='coach-panel-queue']")).not.toBeNull();
    const card = document.querySelector("[data-testid='coach-panel-speakers-card'] button") as HTMLButtonElement;
    expect(card.textContent).toBe(COPY.speakers);
    await act(async () => card.click());
    expect(document.querySelector("[data-testid='coach-panel-all-speakers']")).not.toBeNull();
  });
});
