// @vitest-environment jsdom
/*
STORY    As a speaker, I want every app navbar to share the Speaking Coach
         separator and safe control width, so chrome does not drift between
         project chat, Ideal Text, Feedback, and chat screens.
OUTCOME  O1  The separator is full-width while controls remain safe-width.
PROVES   O1 -> "shared navbar visual contract"
WHY      Founder screenshot visual contract, 2026-11-18.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import TopNavbar, {
  TOP_NAV_CONTENT_CLASS,
  TOP_NAV_SEPARATOR_CLASS,
  TopNavbarBackButton,
} from "./TopNavbar";

let root: Root;
let host: HTMLDivElement;

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

describe("shared navbar visual contract", () => {
  it("keeps the separator full width and controls inside the safe width", () => {
    act(() => root.render(createElement(TopNavbar, null, createElement("button", null, "Back"))));

    const navbar = host.querySelector<HTMLElement>("[data-top-navbar]")!;
    const content = host.querySelector<HTMLElement>("[data-top-navbar-content]")!;
    expect(navbar.className).toContain(TOP_NAV_SEPARATOR_CLASS);
    expect(content.className).toContain(TOP_NAV_CONTENT_CLASS);
    expect(navbar.contains(content)).toBe(true);
  });

  it("exposes the shared left-facing Back control", () => {
    const onClick = () => undefined;
    act(() => root.render(createElement(TopNavbarBackButton, { onClick })));
    const back = host.querySelector<HTMLButtonElement>("[data-top-navbar-back]")!;
    expect(back.getAttribute("aria-label")).toBe("Back");
    expect(back.querySelector("svg")).not.toBeNull();
  });
});
