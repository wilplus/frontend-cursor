// @vitest-environment jsdom
/*
STORY    As a speaker after my Take, I want to be offered, once, someone new
         who fits it, by a pseudonym and their role and never a name, so
         that I can send it to them too or say Not now, and I never want it
         to stand in front of my walk.
OUTCOME
  O1  With a suggestion for my Take and no walk screen up, the page opens:
      "Someone new might be a good match for this Take.", "{Pseudonym}
      works on what you're practising. You could learn from each other.
      Send it to them too?", the pseudonym, the role and "Not in your chats
      yet"; Send sends it and closes the page (N477, N478 item 1, N512).
  O2  Not now closes it on the backend and the page; it is not asked again
      for that Take. While a walk screen is up, it waits.
PROVES   O1 -> "a suggestion opens once the walk is gone, and Send sends it"
         O2 -> "Not now closes it, and the same Take is not asked again"
WHY      Founder 2026-11-04, backend N476 item 2, N477, N478, N512 (the words,
         "Use the prototype's"); the prototype "The Official Inquiry".
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getTakeMatch: vi.fn(async (): Promise<unknown> => ({ id: "m1", pseudonym: "Quiet Heron", role: "Speaking coach" })),
  sendTakeMatch: vi.fn(async () => true),
  closeTakeMatch: vi.fn(async () => true),
}));
vi.mock("@/services/api/takeMatches", () => api);

import TakeMatchSuggestion from "./TakeMatchSuggestion";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  localStorage.clear();
  Object.values(api).forEach((fn) => fn.mockClear());
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.querySelectorAll("[data-walk-column]").forEach((el) => el.remove());
  vi.useRealTimers();
});

const page = () => document.querySelector("[data-take-match]");
const byTest = (id: string) => document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
async function mount() {
  await act(async () => root.render(createElement(TakeMatchSuggestion, { takeSessionId: "take-2", takeCount: 2 })));
  await act(async () => {
    await Promise.resolve();
  });
}

it("a suggestion opens once the walk is gone, and Send sends it", async () => {
  const walk = document.createElement("div");
  walk.setAttribute("data-walk-column", "");
  document.body.appendChild(walk);
  await mount();
  expect(page()).toBeNull();
  walk.remove();
  await act(async () => {
    vi.advanceTimersByTime(1600);
  });
  expect(page()?.textContent).toContain("Someone new might be a good match for this Take.");
  expect(page()?.textContent).toContain("Quiet Heron works on what you're practising. You could learn from each other. Send it to them too?");
  expect(page()?.textContent).toContain("Speaking coach");
  expect(page()?.textContent).toContain("Not in your chats yet");
  await act(async () => byTest("take-match-send")?.click());
  expect(api.sendTakeMatch).toHaveBeenCalledWith("m1");
  expect(page()).toBeNull();
});

it("Not now closes it, and the same Take is not asked again", async () => {
  await mount();
  await act(async () => byTest("take-match-not-now")?.click());
  expect(api.closeTakeMatch).toHaveBeenCalledWith("m1");
  expect(page()).toBeNull();
  await act(async () => root.unmount());
  root = createRoot(host);
  api.getTakeMatch.mockClear();
  await mount();
  expect(api.getTakeMatch).not.toHaveBeenCalled();
  expect(page()).toBeNull();
});
