// @vitest-environment jsdom
/**
 * Back from /privacy or /terms returns to Data & consent when that is where
 * the reader came from (founder 2026-10-07), and home otherwise.
 */
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LegalBackLink from "./LegalBackLink";

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
