// @vitest-environment jsdom
/*
STORY    As a coach with the chat builder's ring, the queue I open from
         Will's line "N moments to answer" has the one top bar, and every
         screen after it has the back arrow and no close; Back goes one step
         and, from the queue, to Will's chat (backend N639).
OUTCOME
  O1  From Will's line, the queue's bar is the arrow and "Your queue", no
      icon; the arrow closes the panel, back to Will's chat.
  O2  A deeper screen (Your speakers) has the back arrow and no close; the
      arrow and the phone's Back go one step, to the queue, then out.
  O3  Opened from the list of chats, the queue keeps a chat's top bar, as
      before.
PROVES   O1 -> "N639 from Will's line the queue has the one bar and Back returns to Will's chat"
         O2 -> "N639 a deeper screen has the back arrow and no close, one step at a time"
         O3 -> "N639 opened from the list of chats, the queue keeps its bar"
WHY      Backend N639. The coach panel is locked: only its top bar and its
         way back change, and only when opened from Will's line.
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../coachwalk/useMomentsQueue", () => ({
  useMomentsQueue: () => ({ speakers: [], waiting: 0, loading: false, settled: true, refresh: () => undefined }),
}));
vi.mock("@/services/api/coachPanel", () => ({
  fetchErrorAudit: vi.fn(async () => null),
  fetchBlockPicks: vi.fn(async () => null),
  fetchV4MomentPicks: vi.fn(async () => null),
  fetchV4SurerPairs: vi.fn(async () => null),
}));
vi.mock("@/services/api/coachSpeakers", async (orig) => ({
  ...(await orig<typeof import("@/services/api/coachSpeakers")>()),
  fetchCoachSpeakers: vi.fn(async () => []),
}));
vi.mock("../coachwalk/useConfidenceChainReceipt", () => ({
  useConfidenceChainReceipt: () => ({ current: null }),
}));

import CoachPanelDoor from "./CoachPanelDoor";
import { openCoachQueue } from "@/lib/willab/coachDoor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
/** Past the walk's motion, so a leaving screen is gone. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 400)); });
const live = (id: string) =>
  [...document.querySelectorAll<HTMLElement>(`[data-testid='${id}']`)].find((el) => !el.closest("[data-walk-ghost]")) ?? null;
const buttons = (el: HTMLElement | null) => [...(el?.querySelectorAll("button") ?? [])].map((b) => b.getAttribute("aria-label") ?? b.textContent);

describe("the coach panel opened from Will's line has the one top bar (backend N639)", () => {
  it("N639 from Will's line the queue has the one bar and Back returns to Will's chat", async () => {
    act(() => root.render(<CoachPanelDoor />));
    await flush();
    act(() => openCoachQueue({ fromWill: true }));
    await flush();
    const queue = live("coach-panel-queue");
    const bar = queue?.querySelector<HTMLElement>("[data-one-top-bar]") ?? null;
    expect(bar?.textContent).toBe("Your queue");
    expect(buttons(bar)).toEqual(["Back"]);
    // One icon only, the arrow: no round Speakers icon, no chat bar.
    expect(bar?.querySelectorAll("svg")).toHaveLength(1);
    expect(queue?.querySelector("[data-chat-header]")).toBeNull();
    await act(async () => bar!.querySelector<HTMLButtonElement>("button")!.click());
    await settle();
    expect(live("coach-panel-queue")).toBeNull();
  });

  it("N639 a deeper screen has the back arrow and no close, one step at a time", async () => {
    act(() => root.render(<CoachPanelDoor />));
    await flush();
    act(() => openCoachQueue({ fromWill: true }));
    await flush();
    const card = live("coach-panel-speakers-card")!.querySelector<HTMLButtonElement>("button")!;
    await act(async () => card.click());
    await settle();
    const speakers = live("coach-panel-all-speakers");
    expect(speakers).not.toBeNull();
    const top = speakers!.querySelector<HTMLElement>(".walk-ovtop");
    expect(buttons(top)).toEqual(["Back"]);
    expect(speakers!.querySelector('button[aria-label="Close"]')).toBeNull();
    // Its own heading stays in the page, under the bar.
    expect(speakers!.querySelector("h2")?.textContent).toBe("Your speakers");

    // The arrow: one step, to the queue.
    await act(async () => top!.querySelector<HTMLButtonElement>("button")!.click());
    await settle();
    expect(live("coach-panel-all-speakers")).toBeNull();
    expect(live("coach-panel-queue")).not.toBeNull();

    // The phone's Back the same: Your speakers, then the queue, then out to Will's chat.
    await act(async () => live("coach-panel-speakers-card")!.querySelector<HTMLButtonElement>("button")!.click());
    await settle();
    await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
    await settle();
    expect(live("coach-panel-queue")).not.toBeNull();
    await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
    await settle();
    expect(live("coach-panel-queue")).toBeNull();
  });

  it("N639 opened from the list of chats, the queue keeps its bar", async () => {
    act(() => root.render(<CoachPanelDoor />));
    await flush();
    act(() => openCoachQueue());
    await flush();
    const queue = live("coach-panel-queue");
    expect(queue?.querySelector("[data-one-top-bar]")).toBeNull();
    expect(queue?.querySelector("[data-chat-header]")?.textContent).toBe("Your queue");
  });
});
