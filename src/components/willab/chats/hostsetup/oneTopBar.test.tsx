// @vitest-environment jsdom
/*
STORY    As a host with the chat builder's ring, what I open from Will's
         lines has one top bar, the back arrow and its name, and Back brings
         me back to Will's chat, where I came from (backend N639).
OUTCOME
  O1  "Your chat" opened from Will's chat opens over his chat, under the one
      bar: the arrow and "Your chat", no "Back" word, no circle, no close
      (a new account: its first screen, "What do you do?");
      the arrow on its first screen brings me back to Will's chat, and so
      does the phone's Back.
  O2  The drafted answers say "Answers to send" in that bar, and Back
      returns to Will's chat.
PROVES   O2 -> "N639 Your chat opened from Will has the one bar, and Back returns to Will's chat"
         O1 -> "N639 Your chat opened from Will has the one bar, and Back returns to Will's chat"
WHY      Backend N639 items 1 and 2. Not a style check: which control there
         is, what it says, and where Back goes.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Call = { path: string; method: string };
const bff = vi.hoisted(() => ({ routes: {} as Record<string, unknown> }));
vi.mock("@/lib/api/bffFetch", () => ({
  bffFetch: vi.fn(async (path: string, init?: { method?: string }) => {
    const call: Call = { path, method: init?.method ?? "GET" };
    const answer = bff.routes[`${call.method} ${path}`];
    if (answer === undefined) return { kind: "response", ok: false, status: 404, body: { code: "NOT_FOUND" } };
    return { kind: "response", ok: true, status: 200, body: answer };
  }),
}));
vi.mock("../../useUserProfile", () => ({ useUserProfile: () => ({ profile: { first_name: "Lena" }, loading: false, isCoach: false }) }));

import HostSetupRows from "./HostSetupRows";
import { forgetSetup, openOverList } from "./hostSetupDoor";
import { forgetHostWork } from "./hostWork";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A new account: the setup opens on Will's "What do you do?". */
const SETUP = { recipe: null, parts: [], own_chat: null, cost: null };

let front: HTMLDivElement;
let root: Root;
beforeEach(() => {
  bff.routes = { "GET /api/v2/chats/setup": SETUP };
  forgetSetup();
  forgetHostWork();
  // The chats' front, put away: Will's chat is open (useChatsDoor).
  front = document.createElement("div");
  front.setAttribute("data-chats-front", "");
  front.setAttribute("data-chats-away", "");
  document.body.appendChild(front);
  root = createRoot(front);
});
afterEach(() => {
  act(() => root.unmount());
  front.remove();
});
const flush = async () => {
  for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); });
};
const overWill = () => document.querySelector("[data-over-will]");
const bar = () => overWill()?.querySelector("[data-one-top-bar]") ?? null;

describe("one top bar for what opens from Will's lines (backend N639)", () => {
  it("N639 Your chat opened from Will has the one bar, and Back returns to Will's chat", async () => {
    act(() => root.render(createElement(HostSetupRows)));
    await flush();
    act(() => openOverList({ open: "parts" }));
    await flush();
    // Over Will's chat, not over the list of chats.
    expect(overWill()?.textContent).toContain("What do you do?");
    expect(front.querySelector("[data-host-setup]")).toBeNull();
    // The arrow and "Your chat": no "Back" word, no circle, no close, not what the person does.
    expect(bar()?.textContent).toBe("Your chat");
    expect([...bar()!.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual(["Back"]);
    expect(overWill()?.querySelector("[data-host-back]")).toBeNull();
    expect(overWill()?.querySelector('button[aria-label="Close"]')).toBeNull();

    await act(async () => bar()!.querySelector<HTMLButtonElement>("button")!.click());
    await flush();
    expect(overWill()).toBeNull();
    // Will's chat is still the one open: nothing took it to the list.
    expect(front.hasAttribute("data-chats-away")).toBe(true);

    // The phone's Back does the same.
    act(() => openOverList({ open: "parts" }));
    await flush();
    expect(bar()?.textContent).toBe("Your chat");
    await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
    await flush();
    expect(overWill()).toBeNull();

    // The drafted answers: the line's own words, without the count.
    bff.routes["GET /api/v2/chats/setup/drafts"] = {
      drafts: [{ message_id: "d1", thread_id: "t1", from: "Kasia", said: "Hi?", answer: "Hello.", lines: [], sensitive: false }],
    };
    act(() => openOverList({ open: "drafts" }));
    await flush();
    expect(bar()?.textContent).toBe("Answers to send");
    await act(async () => bar()!.querySelector<HTMLButtonElement>("button")!.click());
    await flush();
    expect(overWill()).toBeNull();
  });
});
