// @vitest-environment jsdom
/*
STORY    As someone signed in, I want the ☰ menu to hold only what I need,
         without the retired personal invitation control, so that app
         admission and product sharing cannot be confused (N196, N365, N495).
OUTCOME
  O1  Signed in, the menu reads: my name and email (opening my profile),
      Settings, Tokens with the balance, then Sign out. No personal-link row,
      Lab or Log out.
  O2  Tokens shows the balance and opens the Tokens page, on the web and in
      the iPhone app alike (N495; in the app that page has no way to buy,
      N365 item 1).
  O3  Signed out (the blog), the menu is Lab and Log in, as before.
PROVES   O1 -> "signed in, the menu is me, Settings, Tokens and Sign out"
         O2 -> "Tokens shows the balance and opens the Tokens page"
         O3 -> "signed out, the menu is Lab and Log in"
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/chat" }));
vi.mock("@/lib/auth/nativeSignIn", () => ({ isNativeApp: () => false }));

import AppMenu from "./AppMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function open(props: Record<string, unknown>) {
  await act(async () => root.render(createElement(AppMenu, props as never)));
  await act(async () => (container.querySelector("button") as HTMLButtonElement).click());
}

const rows = () =>
  [...container.querySelectorAll("#app-header-menu a, #app-header-menu button, #app-header-menu > div > div")]
    .map((el) => el.textContent?.trim() ?? "")
    .filter(Boolean);

const SIGNED_IN = {
  authState: "signed_in",
  userEmail: "tomek@example.com",
  userName: "Tomek Nowak",
  tokensLabel: "12,000 · 30 Nov",
  dataConsentHref: "/account/data-consent",
  onLogout: () => {},
};

describe("the ☰ menu", () => {
  it("signed in, the menu is me, Settings, Tokens and Sign out", async () => {
    await open(SIGNED_IN);
    const text = container.querySelector("#app-header-menu")?.textContent ?? "";
    expect(text).toContain("Tomek Nowak");
    expect(text).toContain("tomek@example.com");
    const order = ["Settings", "Tokens", "Sign out"].map((w) => text.indexOf(w));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text).not.toContain("Copy my link");
    expect(container.querySelector("[data-add-sheet]")).toBeNull();
    expect(text).not.toContain("Lab");
    expect(text).not.toContain("Log out");
    expect(container.querySelector('#app-header-menu a[href="/profile"]')?.textContent).toContain("Tomek Nowak");
  });

  it("Tokens shows the balance and opens the Tokens page", async () => {
    await open(SIGNED_IN);
    const tokens = container.querySelector('a[href="/dashboard/pricing"]');
    expect(tokens?.textContent).toContain("Tokens");
    expect(tokens?.textContent).toContain("12,000 · 30 Nov");
  });

  it("signed out, the menu is Lab and Log in", async () => {
    await open({ authState: "anonymous", labHref: "/chat" });
    expect(rows()).toEqual(["Lab", "Log in"]);
  });
});
