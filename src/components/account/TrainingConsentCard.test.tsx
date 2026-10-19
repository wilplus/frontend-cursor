// @vitest-environment jsdom
/*
STORY    As a speaker, I want the training switch hidden until offered, off by
         default, and turned off only after a signed confirm, so that training
         uses my moments only with my yes (consent).
OUTCOME
  O1  Nobody sees the switch while the backend keeps it closed, has no
      policy sentence, or cannot be read; the page is told it is not offered.
  O2  Offered, it shows the backend's sentence under the signed title, off
      by default.
  O3  Turning on sends the yes against exactly what was shown.
  O4  Turning off asks first with the signed words, and sends nothing until
      confirmed.
  O5  A refused or failed save says so and leaves the switch as it was.
PROVES   O1 -> "hidden while closed, without a policy, or unreadable"
         O2, O3 -> "off by default, and turns on against exactly what was shown"
         O4 -> "asks first with the signed words before turning off"
         O5 -> "a failed save says so and changes nothing"
WHY      Founder 2026-09-26, the training switch (backend N10).
*/

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

async function renderWith(value: TrainingConsent | null, onOffered = vi.fn()) {
  api.fetchTrainingConsent.mockResolvedValue(value);
  act(() => root.render(createElement(TrainingConsentCard, { onOffered })));
  await flush();
  return onOffered;
}

describe("before it is offered", () => {
  it("hidden while closed, without a policy, or unreadable", async () => {
    for (const value of [state({ available: false }), state({ copy: null }), null]) {
      const onOffered = await renderWith(value);
      expect(container.innerHTML).toBe("");
      expect(onOffered).toHaveBeenCalledWith(false);
      act(() => root.unmount());
      root = createRoot(container);
    }
    expect(api.setTrainingConsent).not.toHaveBeenCalled();
  });
});

describe("once it is available", () => {
  it("off by default, and turns on against exactly what was shown", async () => {
    const onOffered = await renderWith(state());
    expect(onOffered).toHaveBeenCalledWith(true);
    expect(container.textContent).toContain(COPY.trainingTitle);
    expect(container.textContent).toContain(SENTENCE);
    expect(button(COPY.turnOn)?.getAttribute("aria-checked")).toBe("false");
    expect(api.setTrainingConsent).not.toHaveBeenCalled();

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

  it("a failed save says so and changes nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await renderWith(state());
    api.setTrainingConsent.mockResolvedValue({ ok: false, code: "COPY_CHANGED" });
    await act(async () => button(COPY.turnOn)?.click());
    await flush();
    expect(api.setTrainingConsent).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(COPY.failed);
    expect(button(COPY.turnOn)?.getAttribute("aria-checked")).toBe("false");
    vi.mocked(console.error).mockRestore();
  });
});
