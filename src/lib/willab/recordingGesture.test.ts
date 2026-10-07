// @vitest-environment jsdom
/* The recording screens' gesture thresholds, as the founder locked them
   (FOUNDER-LOCK-recording-screens-2026-10-07, "How it moves"). */
import { describe, expect, it } from "vitest";
import {
  followOpacity,
  GLIDE_OUT_MS,
  IDLE_WHEEL,
  keyIntent,
  keyIsForTheScreen,
  LAND_EASE,
  LAND_MS,
  MOMENTUM_MS,
  rubberBand,
  TOUCH_COMMIT_PX,
  touchRelease,
  WHEEL_COMMIT,
  WHEEL_REST_MS,
  WHEEL_SOFT,
  wheelDeltaPx,
  wheelRest,
  wheelStep,
  type WheelState,
} from "./recordingGesture";

const both = () => true;

/** Feed a run of wheel deltas `gap` ms apart; return each action. */
function run(deltas: number[], gap = 16, start: WheelState = IDLE_WHEEL, t0 = 1000) {
  let state = start;
  const actions = deltas.map((deltaY, i) => {
    const out = wheelStep(state, {
      deltaY,
      now: t0 + i * gap,
      innerCanTake: false,
      busy: false,
    });
    state = out.state;
    return out.action;
  });
  return { state, actions };
}

describe("the locked numbers", () => {
  it("are the lock's, exactly", () => {
    expect(TOUCH_COMMIT_PX).toBe(90);
    expect(WHEEL_COMMIT).toBe(140);
    expect(WHEEL_SOFT).toBe(90);
    expect(WHEEL_REST_MS).toBe(220);
    expect(MOMENTUM_MS).toBe(450);
    expect(GLIDE_OUT_MS).toBe(200);
    expect(LAND_MS).toBe(420);
    expect(LAND_EASE).toBe("cubic-bezier(.16,1,.3,1)");
  });
});

describe("touch: a slide moves after 90px of travel", () => {
  it("springs back below 90px and moves at 90px, either way", () => {
    expect(touchRelease(89, both)).toBe(0);
    expect(touchRelease(-89, both)).toBe(0);
    expect(touchRelease(90, both)).toBe(1);
    expect(touchRelease(-90, both)).toBe(-1);
    // The old roadmap moved at 48px: that is a spring-back now.
    expect(touchRelease(48, both)).toBe(0);
  });

  it("springs back at a wall, however far the finger went", () => {
    expect(touchRelease(300, (dir) => dir < 0)).toBe(0);
    expect(touchRelease(-300, (dir) => dir < 0)).toBe(-1);
  });

  it("follows the finger like a rubber band, stiffer against a wall", () => {
    expect(rubberBand(100, true)).toBeCloseTo(42);
    expect(rubberBand(100, false)).toBeCloseTo(16);
    expect(rubberBand(-100, true)).toBeCloseTo(-42);
    // Past 140px of follow it stiffens to a fifth.
    expect(rubberBand(1000, true)).toBeCloseTo(140 + (420 - 140) * 0.2);
    expect(followOpacity(0)).toBe(1);
    expect(followOpacity(1000)).toBeCloseTo(0.65);
  });
});

describe("wheel: 140 at once, or 90 that then rests 220ms", () => {
  it("moves the moment the push reaches 140", () => {
    const { actions } = run([40, 40, 40, 20]);
    expect(actions.slice(0, 3).map((a) => a.kind)).toEqual([
      "follow",
      "follow",
      "follow",
    ]);
    expect(actions[3]).toEqual({ kind: "commit", dir: 1 });
  });

  it("moves backwards on an upward push", () => {
    const { actions } = run([-100, -40]);
    expect(actions[1]).toEqual({ kind: "commit", dir: -1 });
  });

  it("a push of 90 to 139 moves only once the wheel rests", () => {
    const { state, actions } = run([50, 45]);
    expect(actions.every((a) => a.kind === "follow")).toBe(true);
    const rest = wheelRest(state);
    expect(rest.action).toEqual({ kind: "commit", dir: 1 });
    expect(rest.state.locked).toBe(true);
  });

  it("a push under 90 springs back when the wheel rests", () => {
    const { state } = run([40, 49]);
    const rest = wheelRest(state);
    expect(rest.action).toEqual({ kind: "spring" });
    expect(rest.state.acc).toBe(0);
  });

  it("swallows the momentum tail for 450ms after a move: one flick, one slide", () => {
    // A flick that moves, then a long decaying tail 16ms apart.
    const tail = Array.from({ length: 60 }, (_, i) => Math.max(1, 80 - i));
    const { actions } = run([150, ...tail]);
    expect(actions[0]).toEqual({ kind: "commit", dir: 1 });
    expect(actions.slice(1).every((a) => a.kind === "ignore")).toBe(true);
  });

  it("re-arms once the wheel has been quiet for 450ms", () => {
    const first = run([150]);
    let out = wheelStep(first.state, {
      deltaY: 150,
      now: 1000 + MOMENTUM_MS - 1,
      innerCanTake: false,
      busy: false,
    });
    expect(out.action.kind).toBe("ignore");
    out = wheelStep(out.state, {
      deltaY: 150,
      now: 1000 + MOMENTUM_MS - 1 + MOMENTUM_MS,
      innerCanTake: false,
      busy: false,
    });
    expect(out.action).toEqual({ kind: "commit", dir: 1 });
  });

  it("lets the helper words take the scroll first, then moves from their edge", () => {
    let out = wheelStep(IDLE_WHEEL, { deltaY: 60, now: 0, innerCanTake: true, busy: false });
    expect(out.action.kind).toBe("scroll-inner");
    expect(out.state.acc).toBe(0);
    out = wheelStep(out.state, { deltaY: 60, now: 16, innerCanTake: false, busy: false });
    expect(out.action.kind).toBe("follow");
    // Once the push is building at the edge, it is not handed back.
    out = wheelStep(out.state, { deltaY: 60, now: 32, innerCanTake: true, busy: false });
    expect(out.action.kind).toBe("follow");
  });

  it("does not build a push while a move is landing", () => {
    const out = wheelStep(IDLE_WHEEL, { deltaY: 200, now: 0, innerCanTake: false, busy: true });
    expect(out.action.kind).toBe("ignore");
    expect(out.state.acc).toBe(0);
  });

  it("reads lines and pages as px", () => {
    expect(wheelDeltaPx({ deltaY: 3, deltaMode: 1 }, 800)).toBe(48);
    expect(wheelDeltaPx({ deltaY: 1, deltaMode: 2 }, 800)).toBe(800);
    expect(wheelDeltaPx({ deltaY: 7, deltaMode: 0 }, 800)).toBe(7);
  });
});

describe("keys: ↓ Page Down Space forward, ↑ Page Up back, Enter starts", () => {
  it("maps each key", () => {
    expect(keyIntent("ArrowDown")).toBe("forward");
    expect(keyIntent("PageDown")).toBe("forward");
    expect(keyIntent(" ")).toBe("forward");
    expect(keyIntent("ArrowUp")).toBe("back");
    expect(keyIntent("PageUp")).toBe("back");
    expect(keyIntent("Enter")).toBe("start");
    expect(keyIntent("ArrowLeft")).toBeNull();
    expect(keyIntent("a")).toBeNull();
  });

  it("never takes a key from a field, a shortcut or an open dialog", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const key = (over: Partial<Parameters<typeof keyIsForTheScreen>[0]>) => ({
      defaultPrevented: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      target: document.body as EventTarget,
      ...over,
    });
    expect(keyIsForTheScreen(key({}), document, root)).toBe(true);
    const input = document.createElement("input");
    root.appendChild(input);
    expect(keyIsForTheScreen(key({ target: input }), document, root)).toBe(false);
    expect(keyIsForTheScreen(key({ metaKey: true }), document, root)).toBe(false);
    expect(keyIsForTheScreen(key({ defaultPrevented: true }), document, root)).toBe(false);
    const dialog = document.createElement("div");
    dialog.setAttribute("aria-modal", "true");
    document.body.appendChild(dialog);
    expect(keyIsForTheScreen(key({}), document, root)).toBe(false);
    // A modal that CONTAINS the screen is the screen's own frame.
    dialog.appendChild(root);
    expect(keyIsForTheScreen(key({}), document, root)).toBe(true);
    dialog.remove();
  });
});
