// @vitest-environment jsdom
/**
 * The coach's menu no longer carries a Library row (CP3 A, 2026-10-06,
 * decisions log N56.3): the exercise library and the speaking errors page
 * left the coach's app for the founder's admin area, next to the pace panel.
 * "Coaches keep everything they need inside the moment."
 *
 * The corpus row stays coach only: the host passes its href only for a coach,
 * and the menu draws the row only when signed in with an href.
 */
import { act, createElement, forwardRef, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppMenu from "./AppMenu";

vi.mock("next/link", () => ({
  default: forwardRef<HTMLAnchorElement, { href: string; children: ReactNode; onClick?: () => void; className?: string }>(
    function LinkStub({ href, children, onClick, className }, ref) {
      return createElement("a", { href, onClick, className, ref }, children);
    },
  ),
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
});

function openMenu(props: Partial<Parameters<typeof AppMenu>[0]>): HTMLAnchorElement[] {
  act(() => {
    root.render(
      <AppMenu
        authState="signed_in"
        supportEmail="help@example.com"
        communityUrl="https://example.com/community"
        labHref="/chat"
        {...props}
      />,
    );
  });
  const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="Open menu"]');
  act(() => trigger?.click());
  return [...host.querySelectorAll("a")];
}

describe("the coach menu after the Library moved to the admin area", () => {
  it("a coach's menu has the corpus and no Library row", () => {
    const links = openMenu({ corpusHref: "/coach/corpus" });
    expect(links.some((a) => a.textContent === "Training corpus")).toBe(true);
    expect(links.some((a) => a.textContent === "Library")).toBe(false);
    expect(links.some((a) => /\/coach\/(exercises|errors)|\/admin\/(library|errors)/.test(a.getAttribute("href") ?? ""))).toBe(false);
  });

  it("signed out, the corpus row is not drawn even with an href", () => {
    const links = openMenu({ authState: "anonymous", corpusHref: "/coach/corpus" });
    expect(links.some((a) => a.textContent === "Training corpus")).toBe(false);
  });

  it("the menu takes no Library address, and neither mount links the two pages", () => {
    expect(readFileSync("src/components/AppMenu.tsx", "utf8")).not.toContain("libraryHref");
    for (const mount of ["src/components/SiteHeader.tsx", "src/components/dashboard/DashboardHeader.tsx"]) {
      const source = readFileSync(mount, "utf8");
      expect(source, mount).not.toContain("libraryHref");
      expect(source, mount).not.toMatch(/\/coach\/(exercises|errors)|\/admin\/(library|errors)/);
    }
  });
});
