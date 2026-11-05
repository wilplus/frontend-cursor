// @vitest-environment jsdom
/*
STORY    As a speaker, I want to open the app, tap anywhere and say what is on
         my mind, then close it with a double tap, so that a thought is kept
         without getting in the way of my next Take.
OUTCOME
  D1  A tap starts at once; the next tap stops and keeps.
  D2  A double tap on a fresh start closes and throws the start away.
  D3  A double tap while talking stops, keeps and closes.
  D4  The tap that opened the screen, a palm and a swipe do nothing.
  D5  It opens first only when switched on, and then on every open.
  D6  It never opens first over the loop: while a recording, the wait, the
      Ideal Text or the walk is open, it waits for the next open.
PROVES   D1 -> "starts at once, then stops and keeps"
         D2 -> "a double tap on a fresh start closes and undoes the start"
         D3 -> "a double tap while talking stops, keeps and closes"
         D4 -> "ignores the opening tap, a palm and a swipe"
         D5 -> "only when switched on, and then on every open"
         D6 -> "never over a screen of the loop"
WHY      Founder 2026-11-04 (backend N506, N507): taps act at once and a
         double tap undoes the first, so no tap waits; it never opens from a
         link (Never 3); every open, no hourly limit (N522, 2026-11-05).
*/
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";
import { backDismissDepth, useBackDismiss } from "@/components/willab/useBackDismiss";
import {
  openFirst,
  opensFirstNow,
  freshMemory,
  readTap,
  setOpenFirst,
  type Touch,
} from "./dumpScreen";

const tap = (at: number, x = 100, y = 300, extra: Partial<Touch> = {}): Touch => ({
  at, x, y, downX: x, downY: y, size: 10, multi: false, ...extra,
});

describe("the dump screen's taps", () => {
  it("D1 starts at once, then stops and keeps", () => {
    const [first, m1] = readTap(freshMemory(0), tap(1000), false);
    expect(first).toEqual({ kind: "start" });
    const [second] = readTap(m1, tap(5000), true);
    expect(second).toEqual({ kind: "stop" });
  });

  it("D2 a double tap on a fresh start closes and undoes the start", () => {
    const [, m1] = readTap(freshMemory(0), tap(1000), false);
    const [second] = readTap(m1, tap(1150, 110, 305), true);
    expect(second).toEqual({ kind: "close", undoStart: true });
  });

  it("D3 a double tap while talking stops, keeps and closes", () => {
    const [first, m1] = readTap(freshMemory(0), tap(9000), true);
    expect(first).toEqual({ kind: "stop" });
    const [second] = readTap(m1, tap(9200), false);
    expect(second).toEqual({ kind: "close", undoStart: false });
  });

  it("D4 ignores the opening tap, a palm and a swipe", () => {
    const m = freshMemory(1000);
    expect(readTap(m, tap(1200), false)[0].kind).toBe("ignore");
    expect(readTap(m, tap(3000, 100, 300, { size: 120 }), false)[0].kind).toBe("ignore");
    expect(readTap(m, tap(3000, 100, 300, { downY: 200 }), false)[0].kind).toBe("ignore");
  });
});

describe("opening first", () => {
  beforeEach(() => window.localStorage.clear());

  it("D5 only when switched on, and then on every open (N522)", () => {
    expect(openFirst()).toBe(false);
    setOpenFirst(true);
    expect(openFirst()).toBe(true);
    setOpenFirst(false);
    expect(openFirst()).toBe(false);
  });

  it("D6 never over a screen of the loop", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    setOpenFirst(true);
    expect(opensFirstNow(backDismissDepth())).toBe(true);
    // A recording (or the wait, the Ideal Text, the walk): an overlay over the chat.
    function Recording() {
      useBackDismiss(() => undefined);
      return null;
    }
    const root = createRoot(document.createElement("div"));
    act(() => root.render(createElement(Recording)));
    expect(opensFirstNow(backDismissDepth())).toBe(false);
    act(() => root.unmount());
    expect(opensFirstNow(backDismissDepth())).toBe(true);
  });
});
