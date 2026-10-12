// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  FOUNDER 2026-09-26 — the training switch (backend N10), built dark.       */
/*                                                                            */
/*  Pinned here:                                                              */
/*    1. nobody sees it while the backend keeps it closed or has no policy;   */
/*    2. it shows the backend's sentence under the signed title, off by       */
/*       default;                                                             */
/*    3. turning on sends the yes against exactly what was shown;             */
/*    4. turning off asks first with the signed words, and sends nothing      */
/*       until confirmed;                                                     */
/*    5. a failure says so and changes nothing.                               */
/* -------------------------------------------------------------------------- */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchTrainingConsent: vi.fn(),
  setTrainingConsent: vi.fn(),
}));

vi.mock("@/services/api/trainingConsent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/trainingConsent")>();
  return { ...actual, ...api };
});

import TrainingConsentCard from "./TrainingConsentCard";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";
import { type TrainingConsent } from "@/services/api/trainingConsent";

const SENTENCE =
  "Keep separate copies of short moments from my recordings (the audio, its words and my coach's rating) to train WillpowerLab. I can turn this off at any time, and my copies are then deleted.";

function state(over: Partial<TrainingConsent> = {}): TrainingConsent {
  return {
    available: true,
    active: false,
    policyVersion: "training-v1",
    copy: SENTENCE,
    copySha256: "c".repeat(64),
    ...over,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.fetchTrainingConsent.mockReset();
  api.setTrainingConsent.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => { await Promise.resolve(); });
const button = (label: string, scope: ParentNode = container) =>
  Array.from(scope.querySelectorAll<HTMLButtonElement>("button"))
    .find((b) => b.textContent === label);

async function renderWith(value: TrainingConsent | null) {
  api.fetchTrainingConsent.mockResolvedValue(value);
  act(() => root.render(createElement(TrainingConsentCard)));
  await flush();
}

describe("once it is available", () => {

  it("turns on against exactly what was shown", async () => {
    await renderWith(state());
    api.setTrainingConsent.mockResolvedValue(state({ active: true }));
    await act(async () => button(COPY.turnOn)?.click());
    await flush();
    expect(api.setTrainingConsent).toHaveBeenCalledWith(true, state());
    expect(button(COPY.turnOff)?.getAttribute("aria-checked")).toBe("true");
  });

  it("asks first with the signed words before turning off", async () => {
    await renderWith(state({ active: true }));
    await act(async () => button(COPY.turnOff)?.click());
    expect(container.textContent).toContain("Turn off training?");
    expect(container.textContent).toContain(
      "Your training copies will be deleted. Anything already used to train stays in that training, but it won’t be used again.",
    );
    expect(api.setTrainingConsent).not.toHaveBeenCalled();

    api.setTrainingConsent.mockResolvedValue(state({ active: false }));
    const group = container.querySelector('[role="group"]') as HTMLElement;
    await act(async () => button(COPY.turnOff, group)?.click());
    await flush();
    expect(api.setTrainingConsent).toHaveBeenCalledWith(false, state({ active: true }));
    expect(button(COPY.turnOn)).toBeDefined();
  });
});
