// @vitest-environment jsdom
/**
 * The coach's Library row in the one menu (founder 2026-09-30, A8; build plan
 * P2-13; the word "Library" decided 2026-10-05, N48.5 Q25 A). Until this row
 * the Library at /coach/exercises was reachable only by typing its address.
 *
 * Coach only, the way the corpus row is: the host passes the href only for a
 * coach, and the menu draws the row only when signed in with an href.
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

describe("the Library row in the coach menu", () => {
  it("a coach's menu links the Library, before the corpus", () => {
    const links = openMenu({ libraryHref: "/coach/exercises", corpusHref: "/coach/corpus" });
    const labels = links.map((a) => a.textContent);
    const library = links.find((a) => a.textContent === "Library");
    expect(library?.getAttribute("href")).toBe("/coach/exercises");
    expect(labels.indexOf("Library")).toBeLessThan(labels.indexOf("Training corpus"));
  });

  it("anyone the host passes no href for has no Library row at all", () => {
    const links = openMenu({ libraryHref: null, corpusHref: null });
    expect(links.some((a) => a.textContent === "Library")).toBe(false);
    expect(links.some((a) => a.getAttribute("href") === "/coach/exercises")).toBe(false);
  });

  it("signed out, the row is not drawn even with an href", () => {
    const links = openMenu({ authState: "anonymous", libraryHref: "/coach/exercises" });
    expect(links.some((a) => a.textContent === "Library")).toBe(false);
  });

  it("both mounts pass the Library address only for a coach", () => {
    for (const mount of ["src/components/SiteHeader.tsx", "src/components/dashboard/DashboardHeader.tsx"]) {
      const source = readFileSync(mount, "utf8");
      expect(source, mount).toMatch(/libraryHref=\{menu\.isCoach \? "\/coach\/exercises" : null\}/);
    }
  });
});
