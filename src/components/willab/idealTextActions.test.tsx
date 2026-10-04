// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE NEXT MOVE (J1/J4 as of 2026-10-04; formerly THE KEY MOMENT MUST NOT   */
/*  GUESS, retired with the hand-off gate it described).                     */
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
import { postJourneyNextSteps } from "@/services/api/journeyNextSteps";

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

describe("journey decisions J1 and J4 (founder 2026-09-29; Phase 7)", () => {
  const labels = () => [...host.querySelectorAll("button")].map((b) => b.textContent?.trim());

  it("J1: Review feedback and the next Take are never hidden behind next steps", () => {
    render({ takeCount: 1, journeyNextStepsSeen: false, reviewWaiting: true, onReview: vi.fn() });
    expect(labels()).toEqual(["Review feedback", "Record Take 2", "See next steps"]);
  });

  it("offers the next Take while the journey answer is still in flight", () => {
    render({ takeCount: 1, journeyNextStepsSeen: null });
    expect(host.textContent).toContain("Record Take 2");
    expect(host.textContent).not.toContain("See next steps");
  });

  it("See next steps is the quiet link under the next Take on a guided Take", () => {
    render({ takeCount: 2, journeyNextStepsSeen: false });
    expect(labels()).toEqual(["Record Take 3", "See next steps"]);
  });

  it("offers no next steps once seen", () => {
    render({ takeCount: 1, journeyNextStepsSeen: true });
    expect(host.textContent).toContain("Record Take 2");
    expect(host.textContent).not.toContain("See next steps");
  });

  it("never offers next steps outside the guided window", () => {
    render({ takeCount: 4, journeyNextStepsSeen: false });
    expect(labels()).toEqual(["Record again"]);
  });

  it("J4: the end card offers the next Take only", () => {
    render({
      takeCount: 1, journeyNextStepsSeen: false, reviewWaiting: true,
      onReview: vi.fn(), endCard: true,
    });
    expect(labels()).toEqual(["Record Take 2"]);
  });
});

describe("one next step at the bottom (founder 2026-09-26)", () => {
  it("offers Review feedback while a moment waits, with the next take still one tap away", () => {
    const onReview = vi.fn();
    render({ takeCount: 4, journeyNextStepsSeen: true, reviewWaiting: true, onReview });
    const buttons = [...host.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons[0]).toBe("Review feedback");
    // The loop never waits on feedback: the record entry stays.
    expect(buttons.some((t) => t?.includes("Record again"))).toBe(true);
    act(() => (host.querySelector("button") as HTMLButtonElement).click());
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it("makes the next take the main button once nothing waits", () => {
    render({ takeCount: 1, journeyNextStepsSeen: true, reviewWaiting: false, onReview: vi.fn() });
    expect(host.textContent).not.toContain("Review feedback");
    expect(host.querySelector("button")?.textContent).toContain("Record Take 2");
  });

  it("no longer offers Save at the bottom — it lives in the header menu", () => {
    render({ takeCount: 4, journeyNextStepsSeen: true });
    expect(host.textContent).not.toContain("Save the ideal text");
  });
});

/* A GUEST'S "SEE NEXT STEPS" GOES TO SIGN-UP (founder 2026-10-04): "the CTA
 * is not clickable, like nothing happens ... clicking see the next steps
 * should open the sign up page and then should continue seamlessly as if I
 * clicked it as a logged in person." The step saves through an account-only
 * route, so for a guest it failed silently; the guest now goes to sign-up and
 * PendingCoachSend takes the step after it. */
describe("See next steps, account and guest (Phase 0.6)", () => {
  const GUIDED = { takeCount: 1, journeyNextStepsSeen: false };
  const nextSteps = () =>
    Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("See next steps"),
    );

  beforeEach(() => vi.mocked(postJourneyNextSteps).mockClear());

  it("an account takes the step and moves on", async () => {
    const onSeeNextSteps = vi.fn();
    render({ ...GUIDED, onSeeNextSteps });
    await act(async () => {
      nextSteps()?.click();
    });
    expect(postJourneyNextSteps).toHaveBeenCalledWith("arc-1");
    expect(onSeeNextSteps).toHaveBeenCalledTimes(1);
  });

  it("a guest goes to sign-up and nothing is posted as a guest", async () => {
    const onSeeNextSteps = vi.fn();
    const onSeeNextStepsAsGuest = vi.fn();
    render({ ...GUIDED, onSeeNextSteps, onSeeNextStepsAsGuest });
    await act(async () => {
      nextSteps()?.click();
    });
    expect(onSeeNextStepsAsGuest).toHaveBeenCalledTimes(1);
    expect(postJourneyNextSteps).not.toHaveBeenCalled();
    expect(onSeeNextSteps).not.toHaveBeenCalled();
  });
});
