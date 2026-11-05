// @vitest-environment jsdom
/*
STORY    As a speaker opening the chat, I want my conversation drawn before
         the menu's side lookups (the wallet, the Life gate, the product
         discoveries) go out, so that the chat appears fast (founder
         2026-10-16, chatBoot.ts).
OUTCOME
  O1  The menu drawn with the chat while it opens waits for the thread to
      paint, though React runs the menu's effects before the chat's own.
PROVES   O1 -> "the menu drawn with the opening chat waits for the thread"
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api/bootPrefetch", () => ({
  prefetchChatBoot: () => {},
  prefetchChatsDoor: () => {},
  takeSessionState: () => new Promise(() => {}), // the state is still being read
}));

import { useWillabFlow } from "./useWillabFlow";
import { __resetChatBootForTests, markChatBootSettled, useAfterChatBoot } from "@/lib/chatBoot";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** DashboardHeader's menu, as useAppMenuData gates its side reads. */
function Menu() {
  const afterBoot = useAfterChatBoot();
  return createElement("i", { "data-after-boot": String(afterBoot) });
}

/** WillabSurface's shape: the flow, and the menu drawn under it. */
function Surface() {
  useWillabFlow();
  return createElement(Menu);
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  __resetChatBootForTests();
  window.localStorage.setItem("willab.consent_accepted", "1"); // past the Welcome
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
  vi.useRealTimers();
});

const afterBoot = () => container.querySelector("i")?.getAttribute("data-after-boot");

describe("the chat's boot and the menu", () => {
  it("the menu drawn with the opening chat waits for the thread", () => {
    act(() => root.render(createElement(Surface)));
    act(() => vi.advanceTimersByTime(1_000)); // well past "idle"
    expect(afterBoot()).toBe("false");

    act(() => markChatBootSettled()); // the thread has painted
    expect(afterBoot()).toBe("true");
  });
});
