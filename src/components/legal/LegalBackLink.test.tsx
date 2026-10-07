// @vitest-environment jsdom
/**
 * Back from /privacy or /terms returns to Data & consent when that is where
 * the reader came from (founder 2026-10-07), and home otherwise.
 */
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LegalBackLink from "./LegalBackLink";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));

let from: string | null = null;
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(from ? `from=${from}` : ""),
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
