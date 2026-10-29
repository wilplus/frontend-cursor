// @vitest-environment jsdom
/*
 * STORY    As a speaker with a plan, I want "I have a new event" out of my way
 *          while my Take is still processing, so that I never tap something
 *          that leaves me with nothing to do.
 * OUTCOME
 *   O1  While the Take is processing, Change your plan has no "I have a new
 *       event", and the plan's end shows only "Keep practising".
 *   O2  Once the Take has landed, both show "I have a new event" again.
 * PROVES   O1, O2 -> "a new event waits for the Take being processed"
 * WHY      The founder, 2026-10-28 (backend N242); docs/flows/the-plan.md §1
 *          H1 and I2.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Plan } from "@/services/api/plan";
import PlanDock, { type PlanActions } from "./PlanDock";
import { ChangePlanSheet } from "./PlanSheet";

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

const PLAN = {
  id: "plan-1",
  status: "active",
  step: "done",
  deadline: "2026-11-14",
  days: [1, 3, 5],
  days_text: "Mon, Wed, Fri",
  every_day: false,
  level_name: "Let your key line land",
  calls: { kickoff: null, summary: null },
} as unknown as Plan;

const buttons = () => [...host.querySelectorAll("button")].map((b) => b.textContent ?? "");
const offered = () => buttons().some((label) => label.includes("I have a new event"));

function changeYourPlan(processing: boolean) {
  act(() =>
    root.render(
      <ChangePlanSheet
        plan={PLAN}
        onClose={() => {}}
        onDeadline={() => {}}
        onDays={() => {}}
        onAskCoach={() => {}}
        onNewEvent={() => {}}
        newEventHeld={processing}
      />,
    ),
  );
}

function plansEnd(processing: boolean) {
  const actions = { next: vi.fn() } as unknown as PlanActions;
  act(() =>
    root.render(
      <PlanDock
        plan={{ ...PLAN, status: "ending", step: "whats_next" }}
        busy={false}
        booking={null}
        onCloseBooking={() => {}}
        actions={actions}
        newEventHeld={processing}
      />,
    ),
  );
}

it("a new event waits for the Take being processed", () => {
  changeYourPlan(true);
  expect(buttons().some((label) => label.includes("Deadline"))).toBe(true);
  expect(offered()).toBe(false);
  changeYourPlan(false);
  expect(offered()).toBe(true);

  plansEnd(true);
  expect(buttons()).toEqual(["Keep practising"]);
  plansEnd(false);
  expect(buttons()).toEqual(["Keep practising", "I have a new event"]);
});
