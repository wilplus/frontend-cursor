// @vitest-environment jsdom
/*
STORY    As a speaker, I want the shared app header divider to reach both
         viewport edges while its controls stay on the safe content rail.
OUTCOME  O1  The divider is viewport-wide and the header content remains rail-bound.
PROVES   O1 -> "shared authenticated page header"
WHY      Founder screenshot correction, 2026-11-18.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("shared authenticated page header", () => {
  it("keeps the divider viewport-wide and controls rail-bound", () => {
    act(() => root.render(createElement(PageHeader, null, createElement("button", null, "Back"))));

    const header = host.querySelector<HTMLElement>("[data-page-header]")!;
    const content = host.querySelector<HTMLElement>("[data-page-header-content]")!;
    const divider = host.querySelector<HTMLElement>("[data-page-header-divider]")!;

    expect(header.className).toContain("relative");
    expect(content.className).toContain("willab-canvas");
    expect(divider.className).toContain("absolute");
    expect(divider.className).toContain("w-screen");
    expect(divider.className).toContain("bottom-0");
    expect(divider.className).toContain("-translate-x-1/2");
  });
});
