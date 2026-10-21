// @vitest-environment jsdom
/*
STORY    As a person signing in from a link, I want to land on a page of our
         own site and never on another website, so that a crafted link cannot
         take me somewhere else right after I type my password.
OUTCOME
  O1  A redirectTo that leaves the site (another website, "//", one hidden
      behind an extra encoding or a backslash) is ignored: I land on /chat.
  O2  A redirectTo on our own site is still honoured, query and all.
PROVES   O1 -> "an off-site redirectTo (%s) lands on /chat"
         O2 -> "a same-site redirectTo is still honoured"
WHY      Open redirect in the login form (2026-10-21). The coach's WhatsApp
         and email links rely on O2: they land on
         /login?redirectTo=/chat?lens=… (WIL-93).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ error: null }),
      getSession: async () => ({ data: { session: { access_token: "t" } } }),
    },
  }),
}));

import LoginForm from "./LoginForm";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockClear();
  // No Take yet, so the smart redirect lands on /chat.
  vi.stubGlobal("fetch", vi.fn(async (url: string) =>
    new Response(JSON.stringify(url === "/api/results/state" ? { kind: "no_session" } : {}))));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function signInFrom(redirectTo: string) {
  window.history.replaceState({}, "", `/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  act(() => root.render(createElement(LoginForm)));
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.advanceTimersByTimeAsync(1000);
  });
}

describe("signing in from a link with redirectTo", () => {
  it.each([
    "https://example.com",
    "//example.com",
    "/%2Fexample.com",
    "/\\example.com",
  ])("an off-site redirectTo (%s) lands on /chat", async (target) => {
    await signInFrom(target);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/chat");
  });

  it("a same-site redirectTo is still honoured", async () => {
    await signInFrom("/chat?lens=arc-1");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/chat?lens=arc-1");
  });
});
