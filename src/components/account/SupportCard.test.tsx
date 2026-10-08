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
import SupportCard, { COPIED_MS } from "./SupportCard";
import { SUPPORT_EMAIL } from "@/lib/appMenuLinks";

let root: Root;
let host: HTMLDivElement;

function clipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

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

const button = () => host.querySelector('button[aria-label="Copy"]') as HTMLButtonElement;
const address = () => host.querySelector("[data-support-address]") as HTMLElement;
const copied = () => button().getAttribute("data-copied") === "true";

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

  it("has a 36px round bordered copy button beside it", () => {
    const cls = button().className.split(" ");
    for (const c of ["h-9", "w-9", "rounded-full", "border", "border-border"]) expect(cls).toContain(c);
    expect(button().previousElementSibling).toBe(address());
  });

  it("shows no visible word but the title and the address", () => {
    expect(host.textContent).toBe(`Support${SUPPORT_EMAIL}`);
  });
});

describe("copying", () => {
  it("writes the address to the clipboard and shows a check for 1.6 s", async () => {
    const writeText = vi.fn(async () => undefined);
    clipboard(writeText);
    await act(async () => {
      button().click();
    });
    expect(writeText).toHaveBeenCalledWith(SUPPORT_EMAIL);
    expect(copied()).toBe(true);
    act(() => vi.advanceTimersByTime(COPIED_MS - 1));
    expect(copied()).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(copied()).toBe(false);
    expect(host.textContent).toBe(`Support${SUPPORT_EMAIL}`);
  });

  it("selects the address instead when the clipboard is refused", async () => {
    clipboard(vi.fn(async () => { throw new Error("denied"); }));
    await act(async () => {
      button().click();
    });
    expect(copied()).toBe(false);
    expect(window.getSelection()?.toString()).toBe(SUPPORT_EMAIL);
  });

  it("selects the address when there is no clipboard at all", async () => {
    clipboard(undefined);
    await act(async () => {
      button().click();
    });
    expect(copied()).toBe(false);
    expect(window.getSelection()?.toString()).toBe(SUPPORT_EMAIL);
  });

  it("shows the check when the clipboard is refused but the copy command works", async () => {
    clipboard(vi.fn(async () => { throw new Error("denied"); }));
    const exec = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
    try {
      await act(async () => {
        button().click();
      });
      expect(exec).toHaveBeenCalledWith("copy");
      expect(copied()).toBe(true);
      expect(host.textContent).toBe(`Support${SUPPORT_EMAIL}`);
    } finally {
      delete (document as { execCommand?: unknown }).execCommand;
    }
  });
});
