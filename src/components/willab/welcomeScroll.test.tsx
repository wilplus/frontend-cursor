// @vitest-environment jsdom
/* The welcome scrolls from its true top on a short screen (consent lock
   2026-10-07: "every step scrolls from its true top to its last button on
   any phone"; build plan D-CS-2). A centred `justify-center` column inside
   a clipping shell spilled off both ends on a phone on its side: the mark
   was cut and "Enter the lab" could not be reached. */
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WelcomeConsent from "./WelcomeConsent";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const classes = (el: Element | null) => (el?.className ?? "").toString().split(/\s+/);

describe("the welcome", () => {
  it("is its own vertical scroller, laid out with m-auto and never justify-center", () => {
    act(() => root.render(createElement(WelcomeConsent, { onAccept: () => undefined })));
    const scroller = host.firstElementChild!;
    expect(classes(scroller)).toEqual(
      expect.arrayContaining(["flex", "min-h-0", "flex-1", "flex-col", "overflow-y-auto"]),
    );
    const column = scroller.firstElementChild!;
    expect(classes(column)).toEqual(expect.arrayContaining(["m-auto", "px-6", "py-6"]));
    expect(host.innerHTML).not.toMatch(/justify-center[^"]*text-center|items-center justify-center px-6/);
    // The mark comes first and the button last, inside the one column.
    expect(column.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(column.textContent).toContain("Enter the lab");
  });

  it("sits in a bare shell with no padding; every other shell keeps its own", () => {
    const surface = readFileSync("src/components/willab/WillabSurface.tsx", "utf8");
    const fn = surface.slice(surface.indexOf("function shellPadding("));
    expect(fn).toMatch(/if \(bare\) return "";/);
    expect(fn).toMatch(/return `px-4 pb-6 \$\{flush \? "pt-0" : "pt-6"\}`;/);
    // Only the welcome asks for the bare shell.
    expect(surface.match(/,\s*false,\s*true,\s*\)/g)?.length).toBe(1);
    expect(surface).toMatch(/<WelcomeConsent onAccept=\{flow\.acceptConsent\} \/>,\s*false,\s*true,/);
  });
});
