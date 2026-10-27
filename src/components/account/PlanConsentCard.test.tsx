// @vitest-environment jsdom
/*
STORY    As a speaker, I want to turn the plan's personal questions on or off
         in Data & consent, and to be told only what was really deleted, so
         that I share how I feel only when I choose to.
OUTCOME
  O1  Nobody sees the card unless the backend says it applies to them (the
      switch, the ring) or it cannot be read.
  O2  Off, it says so and Turn on sends the yes; on, it says what Will asks.
  O3  Turning off asks first with the signed words, sends nothing until
      confirmed, and says "We deleted your personal answers" only once the
      backend has.
  O4  A turn-off the backend could not finish says so and leaves the yes on.
PROVES   O1 -> "hidden unless the backend offers it"
         O2 -> "off by default, and Turn on sends the yes"
         O3 -> "asks first, and says deleted only after it is"
         O4 -> "a turn-off that fails leaves the yes on"
WHY      Founder 2026-10-27, the plan's own yes, approved as drawn (backend
         N211); the card is docs/flows/the-plan.md D.
*/

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ readPlanConsent: vi.fn(), setPlanConsent: vi.fn() }));
vi.mock("@/services/api/planConsent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/planConsent")>();
  return { ...actual, ...api };
});

import PlanConsentCard from "./PlanConsentCard";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";
import type { PlanConsentState } from "@/services/api/planConsent";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.readPlanConsent.mockReset();
  api.setPlanConsent.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => { await Promise.resolve(); });
const button = (label: string, scope: ParentNode = container) =>
  Array.from(scope.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === label);
const ok = (enabled: boolean, state: PlanConsentState) => ({ ok: true, data: { enabled, state } });

async function render(result: unknown) {
  api.readPlanConsent.mockResolvedValue(result);
  act(() => root.render(createElement(PlanConsentCard)));
  await flush();
}

describe("the plan's own yes in Data & consent", () => {
  it("hidden unless the backend offers it", async () => {
    for (const result of [ok(false, "unanswered"), { ok: false, status: 0, code: null }]) {
      await render(result);
      expect(container.innerHTML).toBe("");
      act(() => root.unmount());
      root = createRoot(container);
    }
    expect(api.setPlanConsent).not.toHaveBeenCalled();
  });

  it("off by default, and Turn on sends the yes", async () => {
    await render(ok(true, "unanswered"));
    expect(container.textContent).toContain(COPY.planTitle);
    expect(container.textContent).toContain(COPY.planOff);
    expect(button(COPY.turnOn)?.getAttribute("aria-checked")).toBe("false");

    api.setPlanConsent.mockResolvedValue(ok(true, "granted"));
    await act(async () => button(COPY.turnOn)?.click());
    await flush();
    expect(api.setPlanConsent).toHaveBeenCalledWith(true);
    expect(container.textContent).toContain(COPY.planOn);
    expect(container.textContent).not.toContain(COPY.planOffDone);
  });

  it("asks first, and says deleted only after it is", async () => {
    await render(ok(true, "granted"));
    await act(async () => button(COPY.turnOff)?.click());
    expect(container.textContent).toContain(COPY.planOffTitle);
    expect(container.textContent).toContain(COPY.planOffBody);
    expect(api.setPlanConsent).not.toHaveBeenCalled();

    api.setPlanConsent.mockResolvedValue(ok(true, "declined"));
    const group = container.querySelector('[role="group"]') as HTMLElement;
    await act(async () => button(COPY.turnOff, group)?.click());
    await flush();
    expect(api.setPlanConsent).toHaveBeenCalledWith(false);
    expect(container.textContent).toContain(COPY.planOff);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(COPY.planOffDone);
  });

  it("a turn-off that fails leaves the yes on", async () => {
    await render(ok(true, "granted"));
    await act(async () => button(COPY.turnOff)?.click());
    api.setPlanConsent.mockResolvedValue({ ok: false, status: 500, code: "V2_ERROR" });
    const group = container.querySelector('[role="group"]') as HTMLElement;
    await act(async () => button(COPY.turnOff, group)?.click());
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(COPY.failed);
    expect(container.textContent).not.toContain(COPY.planOffDone);
    expect(button(COPY.turnOff)?.getAttribute("aria-checked")).toBe("true");
  });
});
