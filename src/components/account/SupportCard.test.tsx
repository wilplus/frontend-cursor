// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE SUPPORT CARD, EXACTLY AS THE SETTINGS PROTOTYPE (build plan D-CS-7;   */
/*  founder 2026-10-07, Q-B14 A (5); ST1 A, N60).                             */
/*                                                                            */
/*  An h2 "Support", the address as plain selectable text (14px / 1.625,      */
/*  select-all, no underline, no mail link), and a 36px round bordered copy   */
/*  button ("Copy"). Copying shows a check for 1.6 s; a refused clipboard     */
/*  selects the address instead. No new visible string.                       */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SupportCard, {  } from "./SupportCard";
import { SUPPORT_EMAIL } from "@/lib/appMenuLinks";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
    root.render(createElement(SupportCard));
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  window.getSelection()?.removeAllRanges();
});
const address = () => host.querySelector("[data-support-address]") as HTMLElement;

describe("the card", () => {
  it("is an h2 and the address as plain selectable text, no link", () => {
    expect(host.querySelector("h2")?.textContent).toBe("Support");
    expect(address().textContent).toBe(SUPPORT_EMAIL);
    expect(address().tagName).toBe("SPAN");
    expect(host.querySelector("a")).toBeNull();
    const cls = address().className.split(" ");
    expect(cls).toContain("select-all");
    expect(cls).toContain("text-sm");
    expect(cls).toContain("leading-[1.625]");
    expect(cls.some((c) => c.includes("underline"))).toBe(false);
  });
});
