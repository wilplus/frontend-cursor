// @vitest-environment jsdom
/*
STORY    As a speaker, I want my coach's changed word to wait for me in the
         chat under "Later · from your coach" and open on its own with
         "Close", so that I watch exactly what my coach sent, once.
OUTCOME
  O1  The coach's bubble rings while the server says the word is new; a tap
      opens only that word, as the walk's one chat (the bar "Your coach",
      the video before the words, no "Your coach" line in the bubble, the
      pill "Close" in the dock); ✕ closes and the ring stays; Close tells the server the Take's word was watched and the ring
      goes.
PROVES   O1 -> "the coach's changed word opens alone; only Close marks it watched"
WHY      Founder 2026-10-19, N80 (D4, D8, D11) and the approved two-phone
         prototype https://claude.ai/artifact/APk56PLZt6o6Cx9qUMKkuk, drawn
         as the lens is since 2026-10-20 (N81, one chat).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";

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

/** The chat's bubble and the lens, wired as the Lounge wires them. */
function Chat({ message }: { message: LoungeMessage }) {
  const coach = useCoachUpdates([message]);
  return createElement("div", null,
    createElement(WalkStepBubble, {
      message,
      card: null,
      waiting: coach.waits(message, false),
      lockedTake: null,
      onOpenIdealText: () => undefined,
      onOpenCoachUpdate: coach.open,
    }),
    coach.lens);
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  bff.mockClear();
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
// The lens is one chat (N81): its bar, its one part, the dock under it.
const layer = () => document.querySelector<HTMLElement>(".walk-layer:not(.walk-ghost)");
const lens = () => layer()?.querySelector("[data-testid='walk-screen-update']") ?? null;
const pill = () => layer()!.querySelector<HTMLButtonElement>("[data-walk-dock] [data-walk-pill]")!;
const seenCalls = () => bff.mock.calls.filter(([path]) => path === "/api/v2/user/coach-feedback/seen");

describe("the coach's changed word (N80)", () => {
  it("the coach's changed word opens alone; only Close marks it watched", async () => {
    await act(async () => root.render(createElement(Chat, { message: LATER })));
    expect(rings()).toBe(true);

    await act(async () => bubble().click());
    const screen = lens()!;
    expect(layer()!.querySelector("[data-walk-nav]")?.textContent).toContain("Your coach");
    const word = screen.querySelector("[data-walk-message] [data-bubble]")!;
    expect(word.firstElementChild?.hasAttribute("data-coach-video")).toBe(true);
    expect(word.textContent).toBe("Keep the pause after the number.");
    expect(pill().textContent).toBe("Close");

    // ✕ (the bar's): back to the chat, marked as before, the server told nothing.
    await act(async () => layer()!.querySelector<HTMLButtonElement>('.walk-ovtop button[aria-label="Close"]')!.click());
    expect(lens()).toBeNull();
    expect(rings()).toBe(true);
    expect(seenCalls()).toHaveLength(0);

    // Close: the Take's word is watched, and the ring goes.
    await act(async () => bubble().click());
    await act(async () => pill().click());
    expect(lens()).toBeNull();
    expect(rings()).toBe(false);
    expect(seenCalls()).toHaveLength(1);
    expect(seenCalls()[0][1]).toMatchObject({ method: "POST", json: { take_session_id: "take-1" } });
  });
});
