// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  A finger drags the walk's screens (founder 2026-10-18): to the left goes   */
/*  on, as ›; to the right goes back, as ‹; a scroll or a short drag does      */
/*  nothing, and ✕ alone closes.                                               */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function show(nav: WalkNav, onClose = vi.fn()) {
  act(() =>
    root.render(
      <div data-feedback-walk>
        <WalkOverlay nav={nav} onClose={onClose}>
          <p data-testid="words">Say this one like your confident moment.</p>
        </WalkOverlay>
      </div>,
    ),
  );
  return host.querySelector<HTMLElement>("[data-testid='words']")!;
}

/** A touch, from (x, y) by (dx, dy), lifted after `ms`. */
function drag(on: HTMLElement, dx: number, dy = 0, ms = 300) {
  const fire = (type: string, x: number, y: number, t: number) => {
    const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperties(e, {
      pointerType: { value: "touch" },
      pointerId: { value: 1 },
      isPrimary: { value: true },
      timeStamp: { value: t },
    });
    act(() => void on.dispatchEvent(e));
  };
  fire("pointerdown", 200, 300, 0);
  fire("pointermove", 200 + dx / 2, 300 + dy / 2, ms / 2);
  fire("pointermove", 200 + dx, 300 + dy, ms);
  fire("pointerup", 200 + dx, 300 + dy, ms);
}

function nav(over: Partial<WalkNav> = {}): WalkNav {
  return { label: "Slide 2", index: 1, total: 3, onBack: vi.fn(), onNext: vi.fn(), ...over };
}

describe("dragging a walk screen", () => {
  it("goes on to the left and back to the right", () => {
    const n = nav();
    const words = show(n);
    drag(words, -120);
    expect(n.onNext).toHaveBeenCalledTimes(1);
    drag(words, 120);
    expect(n.onBack).toHaveBeenCalledTimes(1);
  });

  it("leaves a scroll, a short drag and an arrow that is off alone, and never closes", () => {
    const onClose = vi.fn();
    const n = nav({ backDisabled: true });
    const words = show(n, onClose);
    drag(words, -20, 160);
    drag(words, -30, 0, 400);
    drag(words, 160);
    expect(n.onNext).not.toHaveBeenCalled();
    expect(n.onBack).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
