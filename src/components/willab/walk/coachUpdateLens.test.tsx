// @vitest-environment jsdom
/*
STORY    As a speaker, I want my coach's changed word to wait for me in the
         chat under "Later · from your coach" and open the walk at my coach's
         place when I tap it, the same way every bubble opens its step, so
         that I watch exactly what my coach sent, where it belongs.
OUTCOME
  O1  The coach's bubble rings while the server says the word is new; a tap
      opens the Take's walk at the coach's step (Step 0 for a general word),
      not a screen of its own; nothing is marked watched by the tap.
  O2  Once the server has heard it (its next read says the word is not
      new), the ring goes; a later change of the word rings again.
PROVES   O1 -> "the coach's changed word opens the walk at the coach's step; the tap marks nothing"
         O2 -> "a word changed again after it was watched rings again"
WHY      Founder 2026-10-19, N80 (D4, D7); 2026-10-20, N89 ("THE SAME
         MECHANISM"): the word alone in its own lens with Close is history.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { WalkStepTarget } from "@/lib/willab/feedbackWalkModel";

const bff = vi.fn(async (..._args: unknown[]) => ({ kind: "response", ok: true, status: 200, body: { messages: [] } }));
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch: (...a: unknown[]) => bff(...a) }));

import { WalkStepBubble, useCoachUpdates } from "../Lounge";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LATER: LoungeMessage = {
  client_id: "later-1",
  role: "bot",
  kind: "walk_step",
  body: "Your coach\nKeep the pause after the number.",
  metadata: {
    take_session_id: "take-1",
    arc_id: "arc-1",
    step: "coachnote",
    author: "coach",
    coach_update: true,
    heading: "Later · from your coach",
    video: "https://media/coach-feedback/take-1/v2.mp4?sig=a",
    unseen: true,
  },
  client_created_at: "2026-10-19T10:00:00Z",
};

const opened: Array<[string, string | undefined, WalkStepTarget | null | undefined]> = [];

/** The chat's bubble, wired as the Lounge wires it. */
function Chat({ message }: { message: LoungeMessage }) {
  const coach = useCoachUpdates([message]);
  return createElement(WalkStepBubble, {
    message,
    card: null,
    waiting: coach.waits(message, false),
    lockedTake: null,
    onOpenIdealText: (arc, mode, at) => {
      opened.push([arc, mode, at]);
    },
  });
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  bff.mockClear();
  opened.length = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const bubble = () => host.querySelector<HTMLButtonElement>("[data-walk-step-bubble]")!;
const rings = () => bubble().className.includes("ring-2");
const seenCalls = () => bff.mock.calls.filter(([path]) => path === "/api/v2/user/coach-feedback/seen");

describe("the coach's changed word (N80, N89)", () => {
  it("the coach's changed word opens the walk at the coach's step; the tap marks nothing", async () => {
    await act(async () => root.render(createElement(Chat, { message: LATER })));
    expect(rings()).toBe(true);
    await act(async () => bubble().click());
    // The one door: the Take's walk, at the coach's step, as any bubble.
    expect(opened).toEqual([["arc-1", "review", { step: "coachnote", moment: null, take: "take-1", part: null }]]);
    expect(document.querySelector("[data-testid='walk-screen-update']")).toBeNull();
    // Opening marks nothing: only Continue on the coach's step does (N80).
    expect(rings()).toBe(true);
    expect(seenCalls()).toHaveLength(0);
  });

  it("a word changed again after it was watched rings again", async () => {
    const as = (unseen: boolean) => ({ ...LATER, metadata: { ...LATER.metadata, unseen } });
    await act(async () => root.render(createElement(Chat, { message: as(true) })));
    expect(rings()).toBe(true);
    // The server's next read: watched (Continue on the coach's step, or
    // another device).
    await act(async () => root.render(createElement(Chat, { message: as(false) })));
    expect(rings()).toBe(false);
    // The coach changes the word: the server says new, and it rings again.
    await act(async () => root.render(createElement(Chat, { message: as(true) })));
    expect(rings()).toBe(true);
  });
});
