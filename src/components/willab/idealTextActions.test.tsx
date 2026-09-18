// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE KEY MOMENT MUST NOT GUESS                                              */
/*  (reported from real use 2026-09-18: "for a moment Record take 2 and then   */
/*   next steps ... i want it without this lag and without closing the app")   */
/*                                                                            */
/*  `journeyNextStepsSeen` is `boolean | null`, and null means NOT KNOWN YET.  */
/*  The old test was `journeyNextStepsSeen === false`, which reads null and    */
/*  true identically — so while the answer was in flight the screen offered    */
/*  the record button, the one action that skips the hand-off entirely.        */
/*                                                                            */
/*  This is the hinge of record -> Take -> next Take, so being wrong here for  */
/*  a second is worse than being blank for a second. Bounded, though: a guided */
/*  take that never learns the answer gets the record button back rather than  */
/*  no action at all.                                                          */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api/saveIdealText", () => ({
  saveIdealText: vi.fn(async () => ({ kind: "nothing" })),
}));
vi.mock("@/services/api/journeyNextSteps", () => ({
  postJourneyNextSteps: vi.fn(async () => true),
}));

import IdealTextActions from "./IdealTextActions";

let root: Root;
let host: HTMLDivElement;

const BASE = {
  arcId: "arc-1",
  saved: null as boolean | null,
  onSaved: () => undefined,
  onNewTake: () => undefined,
};

function render(props: Record<string, unknown>) {
  act(() => {
    root.render(createElement(IdealTextActions, { ...BASE, ...props } as never));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("the next-step decision", () => {
  it("offers neither button while the answer is still in flight", () => {
    // THE BUG. takeCount has landed, journeyNextStepsSeen has not. The screen
    // used to answer "Record Take 2" here with no basis for it.
    render({ takeCount: 1, journeyNextStepsSeen: null });
    expect(host.textContent).not.toContain("Record Take 2");
    expect(host.textContent).not.toContain("See next steps");
  });

  it("offers next steps the moment the answer says it is unseen", () => {
    render({ takeCount: 1, journeyNextStepsSeen: null });
    render({ takeCount: 1, journeyNextStepsSeen: false });
    expect(host.textContent).toContain("See next steps");
    expect(host.textContent).not.toContain("Record Take 2");
  });

  it("offers the next take once the answer says it is already seen", () => {
    render({ takeCount: 1, journeyNextStepsSeen: true });
    expect(host.textContent).toContain("Record Take 2");
    expect(host.textContent).not.toContain("See next steps");
  });

  it("never blanks a take outside the guided window", () => {
    // The withholding is scoped to takes 1-3. A fourth take has no hand-off
    // to wait for, so an unknown answer must not cost it its record button.
    render({ takeCount: 4, journeyNextStepsSeen: null });
    expect(host.textContent).toContain("Record again");
  });

  it("gives the record button back if the answer never arrives", () => {
    // Bounded: a guided take with no action at all is worse than the
    // behaviour this replaces.
    render({ takeCount: 1, journeyNextStepsSeen: null });
    expect(host.textContent).not.toContain("Record Take 2");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(host.textContent).toContain("Record Take 2");
  });

  it("does not start the clock once the answer is known", () => {
    // A known answer must never be walked back by a stale timer.
    render({ takeCount: 1, journeyNextStepsSeen: false });
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(host.textContent).toContain("See next steps");
    expect(host.textContent).not.toContain("Record Take 2");
  });
});
