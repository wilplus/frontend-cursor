// @vitest-environment jsdom
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePinThreadBottom } from "./usePinThreadBottom";
import { notifyThreadToLatest } from "@/lib/willabWindowEvents";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A thread whose scrollHeight we control, so "at the bottom" is observable. */
function Thread({ count, ready }: { count: number; ready: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const opened = useRef(true);
  usePinThreadBottom(ref, count, !ready, opened);
  return createElement(
    "div",
    {
      "data-testid": "thread",
      ref: (el: HTMLDivElement | null) => {
        ref.current = el;
        if (el) Object.defineProperty(el, "scrollHeight", { value: 900, configurable: true });
      },
    },
    createElement("div"),
  );
}

let host: HTMLDivElement;
let root: Root;
const draw = (count: number, ready = true) =>
  act(() => root.render(createElement(Thread, { count, ready })));
const thread = () => host.querySelector<HTMLDivElement>('[data-testid="thread"]')!;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("the newest bubble is always shown (founder 2026-09-28)", () => {
  it("scrolls to the bottom when a new message arrives, even if scrolled up", () => {
    draw(3);
    thread().scrollTop = 100; // the speaker had scrolled up to read
    draw(4);
    expect(thread().scrollTop).toBe(900);
  });

  it("does not move a thread that only re-rendered", () => {
    draw(3);
    thread().scrollTop = 100;
    draw(3);
    expect(thread().scrollTop).toBe(100);
  });

  it("does not jump while the thread is still loading its history", () => {
    draw(0, false);
    thread().scrollTop = 0;
    draw(12, false);
    expect(thread().scrollTop).toBe(0);
  });

  it("lands on the newest bubble after See next steps", () => {
    draw(3);
    thread().scrollTop = 100;
    act(() => notifyThreadToLatest());
    expect(thread().scrollTop).toBe(900);
  });
});
