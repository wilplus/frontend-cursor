// @vitest-environment jsdom
/**
 * Back from /privacy or /terms returns to Data & consent when that is where
 * the reader came from (founder 2026-10-07), and home otherwise.
 */
import { act, createElement, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LegalBackLink from "./LegalBackLink";
import {
  rememberDataConsentLeave,
  takeDataConsentReturn,
  useDataConsentReturn,
} from "./legalReturn";

/* The Link stand-in follows next/link: a click it is not told to skip is a
   navigation, a push unless `replace`. */
const nav = vi.hoisted(() => ({
  pushed: [] as string[],
  replaced: [] as string[],
  back: 0,
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    replace,
    onClick,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
    replace?: boolean;
    onClick?: (event: MouseEvent) => void;
  }) =>
    createElement(
      "a",
      {
        href,
        className,
        onClick: (event: MouseEvent) => {
          onClick?.(event);
          const skipped = event.defaultPrevented;
          event.preventDefault(); // jsdom must not follow the href
          if (!skipped) (replace ? nav.replaced : nav.pushed).push(href);
        },
      },
      children,
    ),
}));

let from: string | null = null;
let pathname = "/privacy";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(from ? `from=${from}` : ""),
  usePathname: () => pathname,
  useRouter: () => ({
    back: () => {
      nav.back += 1;
    },
    push: (href: string) => nav.pushed.push(href),
    replace: (href: string) => nav.replaced.push(href),
  }),
}));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  from = null;
  pathname = "/privacy";
  nav.pushed = [];
  nav.replaced = [];
  nav.back = 0;
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

function link() {
  act(() => root.render(createElement(LegalBackLink)));
  return host.querySelector("a");
}

describe("the legal pages' back link", () => {
  it("returns to Data & consent when opened from there", () => {
    from = "data-consent";
    const a = link();
    expect(a?.getAttribute("href")).toBe("/account/data-consent");
    expect(a?.textContent).toBe("Back");
  });

  it("goes home from anywhere else", () => {
    const a = link();
    expect(a?.getAttribute("href")).toBe("/");
    expect(a?.textContent).toBe("Back home");
  });
});

/* -------------------------------------------------------------------------- */
/*  Back to the same spot, without growing history (build plan D-CS-5).       */
/* -------------------------------------------------------------------------- */

/** Data & consent in miniature: the app's scrolling slot, the page in it,
 *  the page's return hook and its Privacy link's leave. */
function DataConsent({ onPage }: { onPage?: (page: HTMLElement | null) => void }) {
  const ref = useRef<HTMLElement | null>(null);
  useDataConsentReturn(ref);
  return createElement(
    "div",
    { "data-testid": "slot", style: { overflowY: "auto" } },
    createElement("main", {
      ref: (el: HTMLElement | null) => {
        ref.current = el;
        onPage?.(el);
      },
    }),
  );
}

function slot(): HTMLElement {
  return host.querySelector('[data-testid="slot"]')!;
}

function clickBack() {
  const a = link()!;
  act(() => {
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

describe("Back to the same spot on Data & consent", () => {
  it("is the browser's own back when Data & consent is the entry behind", () => {
    // On Data & consent, 900px down, the Privacy link is followed.
    let page: HTMLElement | null = null;
    act(() => root.render(createElement(DataConsent, { onPage: (el) => (page = el) })));
    slot().scrollTop = 900;
    rememberDataConsentLeave(page, "/privacy");
    act(() => root.render(createElement("div")));

    from = "data-consent";
    pathname = "/privacy";
    clickBack();
    expect(nav.back).toBe(1);
    // Nothing pushed or replaced: history does not grow, and the back
    // gesture afterwards goes where it went before Data & consent.
    expect(nav.pushed).toEqual([]);
    expect(nav.replaced).toEqual([]);

    // Data & consent opens again, where it was left.
    act(() => root.render(createElement(DataConsent)));
    expect(slot().scrollTop).toBe(900);
  });

  it("replaces the legal page with Data & consent when it is not behind it", () => {
    // Opened straight from a link elsewhere: no leave was recorded.
    from = "data-consent";
    pathname = "/terms";
    clickBack();
    expect(nav.back).toBe(0);
    expect(nav.pushed).toEqual([]);
    expect(nav.replaced).toEqual(["/account/data-consent"]);
  });

  it("does not take the router back for the other legal page", () => {
    rememberDataConsentLeave(null, "/privacy");
    from = "data-consent";
    pathname = "/terms";
    clickBack();
    expect(nav.back).toBe(0);
    expect(nav.replaced).toEqual(["/account/data-consent"]);
  });

  it("restores the spot after the link fallback too", () => {
    let page: HTMLElement | null = null;
    act(() => root.render(createElement(DataConsent, { onPage: (el) => (page = el) })));
    slot().scrollTop = 420;
    rememberDataConsentLeave(page, "/terms");
    act(() => root.render(createElement("div")));
    from = "data-consent";
    pathname = "/privacy"; // not the page that was opened: the fallback
    clickBack();
    expect(nav.replaced).toEqual(["/account/data-consent"]);
    act(() => root.render(createElement(DataConsent)));
    expect(slot().scrollTop).toBe(420);
  });

  it("starts at the top when arriving any other way (the menu)", () => {
    let page: HTMLElement | null = null;
    act(() => root.render(createElement(DataConsent, { onPage: (el) => (page = el) })));
    slot().scrollTop = 700;
    rememberDataConsentLeave(page, "/privacy");
    // No Back pressed: the next arrival is not a return.
    expect(takeDataConsentReturn()).toBeNull();
    act(() => root.render(createElement("div")));
    act(() => root.render(createElement(DataConsent)));
    expect(slot().scrollTop).toBe(0);
  });

  it("survives a blocked session store", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberDataConsentLeave(null, "/privacy")).not.toThrow();
    from = "data-consent";
    clickBack();
    expect(nav.replaced).toEqual(["/account/data-consent"]);
    expect(takeDataConsentReturn()).toBeNull();
  });
});
