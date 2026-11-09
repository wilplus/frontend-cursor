// @vitest-environment jsdom
/*
STORY    As a person signing up or in at work, I want a "Microsoft" button
         beside Google, so that I can use my work account (backend N401
         item 6).
OUTCOME
  O1  Once switched on, "Microsoft" sits beside Google under "or"; tapping
      it starts Supabase's Microsoft (Azure) sign-in, asking for the email,
      and a refused replay restarts it once. Off, it is not there.
PROVES   O1 -> "Microsoft sits beside Google once switched on and starts its sign-in; off, it is not there"
WHY      Backend N401 items 6 and 7 (founder, 3 November 2026): "a Microsoft
         sign-in button beside Google", the word signed. Hidden until the
         founder turns the Azure provider on in Supabase
         (NEXT_PUBLIC_MICROSOFT_SIGNIN=on).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const signInWithOAuth = vi.hoisted(() => vi.fn(async () => ({ data: { url: null }, error: null })));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: async () => ({ error: null }), signInWithOAuth } }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import OtherWays from "./OtherWays";
import { claimOAuthRetry } from "@/lib/auth/oauthRetry";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.localStorage.clear();
  signInWithOAuth.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllEnvs();
});

const names = () => [...host.querySelectorAll("button")].map((b) => b.textContent?.trim());

it("Microsoft sits beside Google once switched on and starts its sign-in; off, it is not there", async () => {
  act(() => root.render(createElement(OtherWays, { mode: "signup", onEmail: () => undefined })));
  expect(names()).not.toContain("Microsoft");

  vi.stubEnv("NEXT_PUBLIC_MICROSOFT_SIGNIN", "on");
  act(() => root.unmount());
  root = createRoot(host);
  act(() => root.render(createElement(OtherWays, { mode: "login", onEmail: () => undefined })));
  const shown = names();
  expect(shown.indexOf("Microsoft")).toBe(shown.indexOf("Google") + 1);

  await act(async () => (host.querySelector("[data-auth-microsoft]") as HTMLButtonElement).click());
  expect(signInWithOAuth).toHaveBeenCalledWith({
    provider: "azure",
    options: expect.objectContaining({ scopes: "email", skipBrowserRedirect: true }),
  });
  // A refused replay restarts Microsoft, once.
  expect(claimOAuthRetry()).toBe("azure");
  expect(claimOAuthRetry()).toBeNull();
});
