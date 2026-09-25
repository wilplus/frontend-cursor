// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  FOUNDER 2026-09-25 — the Data & consent page (F2, E2-E5).                 */
/*                                                                            */
/*  Pinned here:                                                              */
/*    1. turning practice off and withdrawing sensitive information each ask  */
/*       first, and nothing is sent until the person confirms;               */
/*    2. turning back on needs no confirm;                                    */
/*    3. a failure says so and changes nothing;                               */
/*    4. the coach is told when a speaker has practice off;                   */
/*    5. the record screen says why recording is off.                         */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchConsentChoices: vi.fn(),
  setConsentChoice: vi.fn(),
}));

vi.mock("@/services/api/consentChoices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/consentChoices")>();
  return { ...actual, ...api };
});

import DataConsentChoices from "./DataConsentChoices";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";
import { mapConsentChoices, type ConsentChoices } from "@/services/api/consentChoices";
import { SpeakerPracticeOffNote } from "@/components/willab/coachMomentErrors";

const SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

function choices(over: Partial<ConsentChoices> = {}): ConsentChoices {
  return {
    hasReceipt: true,
    personalisedPractice: true,
    sensitiveInformation: true,
    practiceErasureComplete: null,
    ...over,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.fetchConsentChoices.mockReset();
  api.setConsentChoice.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => { await Promise.resolve(); });
const buttons = (label: string) =>
  Array.from(container.querySelectorAll("button")).filter((b) => b.textContent === label);
const section = (title: string) =>
  container.querySelector(`section[aria-label="${title}"]`) as HTMLElement;
const inSection = (title: string, label: string) =>
  Array.from(section(title).querySelectorAll("button")).find((b) => b.textContent === label);

async function renderWith(value: ConsentChoices | null) {
  api.fetchConsentChoices.mockResolvedValue(value);
  act(() => root.render(createElement(DataConsentChoices)));
  await flush();
}

describe("mapConsentChoices", () => {
  it("reads the backend's answer, including an unfinished erasure", () => {
    expect(mapConsentChoices({
      has_receipt: true,
      personalised_practice: false,
      sensitive_information: true,
      practice_erasure: { complete: false },
    })).toEqual(choices({ personalisedPractice: false, practiceErasureComplete: false }));
    expect(mapConsentChoices({ nothing: true })).toBeNull();
  });
});

describe("the page", () => {
  it("shows both choices once there is an agreement to change", async () => {
    await renderWith(choices());
    expect(section(COPY.practiceTitle)).not.toBeNull();
    expect(section(COPY.sensitiveTitle)).not.toBeNull();
    expect(container.textContent).toContain(COPY.intro);
  });

  it("shows no switches before anything was agreed", async () => {
    await renderWith(choices({ hasReceipt: false }));
    expect(container.querySelector("section")).toBeNull();
  });

  it("says so when the choices cannot be read", async () => {
    await renderWith(null);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(COPY.loadFailed);
  });
});

describe("turning practice off", () => {
  it("asks first, and sends nothing until confirmed", async () => {
    await renderWith(choices());
    await act(async () => inSection(COPY.practiceTitle, COPY.turnOff)?.click());
    expect(container.textContent).toContain(COPY.turnOffConfirm);
    expect(api.setConsentChoice).not.toHaveBeenCalled();

    api.setConsentChoice.mockResolvedValue(choices({ personalisedPractice: false }));
    const confirm = Array.from(section(COPY.practiceTitle)
      .querySelectorAll<HTMLButtonElement>('[role="group"] button')).find((b) => b.textContent === COPY.turnOff);
    await act(async () => confirm?.click());
    await flush();
    expect(api.setConsentChoice).toHaveBeenCalledWith("personalised_practice", false);
    expect(container.textContent).toContain(COPY.practiceOff);
  });

  it("can be cancelled", async () => {
    await renderWith(choices());
    await act(async () => inSection(COPY.practiceTitle, COPY.turnOff)?.click());
    await act(async () => inSection(COPY.practiceTitle, COPY.cancel)?.click());
    expect(container.textContent).not.toContain(COPY.turnOffConfirm);
    expect(api.setConsentChoice).not.toHaveBeenCalled();
  });

  it("says when the recordings are still being deleted", async () => {
    await renderWith(choices({ personalisedPractice: false, practiceErasureComplete: false }));
    expect(container.textContent).toContain(COPY.erasureFinishing);
  });

  it("turns back on without a confirm", async () => {
    api.setConsentChoice.mockResolvedValue(choices());
    await renderWith(choices({ personalisedPractice: false }));
    await act(async () => inSection(COPY.practiceTitle, COPY.turnOn)?.click());
    await flush();
    expect(api.setConsentChoice).toHaveBeenCalledWith("personalised_practice", true);
    expect(container.textContent).toContain(COPY.practiceOn);
  });

  it("says so when the change fails, and changes nothing", async () => {
    api.setConsentChoice.mockResolvedValue(null);
    await renderWith(choices({ personalisedPractice: false }));
    await act(async () => inSection(COPY.practiceTitle, COPY.turnOn)?.click());
    await flush();
    expect(section(COPY.practiceTitle).querySelector('[role="alert"]')?.textContent)
      .toBe(COPY.failed);
    expect(inSection(COPY.practiceTitle, COPY.turnOn)).toBeDefined();
  });
});

describe("withdrawing sensitive information", () => {
  it("asks first, then stops recording, and can be agreed again", async () => {
    await renderWith(choices());
    await act(async () => inSection(COPY.sensitiveTitle, COPY.withdraw)?.click());
    expect(container.textContent).toContain(COPY.withdrawConfirm);
    expect(api.setConsentChoice).not.toHaveBeenCalled();

    api.setConsentChoice.mockResolvedValue(choices({ sensitiveInformation: false }));
    const confirm = Array.from(section(COPY.sensitiveTitle)
      .querySelectorAll<HTMLButtonElement>('[role="group"] button')).find((b) => b.textContent === COPY.withdraw);
    await act(async () => confirm?.click());
    await flush();
    expect(api.setConsentChoice).toHaveBeenCalledWith("sensitive_information", false);
    expect(container.textContent).toContain(COPY.recordingOff);

    api.setConsentChoice.mockResolvedValue(choices());
    await act(async () => inSection(COPY.sensitiveTitle, COPY.agreeAgain)?.click());
    await flush();
    expect(api.setConsentChoice).toHaveBeenLastCalledWith("sensitive_information", true);
  });
});

describe("around the page", () => {
  it("the BFF opens the choices path and nothing more", () => {
    const route = read("app/api/v2/processing-authorization/[[...path]]/route.ts");
    expect(route).toContain('choices: ["GET", "POST"]');
    expect(route).not.toContain("data-rights: [");
  });

  it("the coach is told when the speaker has practice off, and only then", () => {
    act(() => root.render(createElement(SpeakerPracticeOffNote, { enabled: true, speakerOff: true })));
    expect(container.textContent).toBe(COPY.coachSpeakerOff);
    act(() => root.render(createElement(SpeakerPracticeOffNote, { enabled: true, speakerOff: false })));
    expect(container.textContent).toBe("");
    act(() => root.render(createElement(SpeakerPracticeOffNote, { enabled: false, speakerOff: true })));
    expect(container.textContent).toBe("");
  });

  it("the coach fetch reports a speaker with practice off", async () => {
    const actual = await vi.importActual<typeof import("@/services/api/coachConfidencePractice")>(
      "@/services/api/coachConfidencePractice",
    );
    const onSpeakerOff = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ code: "SPEAKER_PRACTICE_OFF" }),
    }));
    try {
      const out = await actual.fetchCoachConfidencePractice("s", "sn", { onSpeakerOff });
      expect(out).toBeNull();
      expect(onSpeakerOff).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("the record screen says why recording is off", () => {
    const lab = read("services/api/labRecording.ts");
    expect(lab).toContain('code === "PROCESSING_RECORDING_WITHDRAWN"');
    expect(lab).toContain("DATA_CONSENT_COPY.recordScreenOff");
  });

  it("buttons read as what they do", async () => {
    await renderWith(choices());
    expect(buttons(COPY.turnOff)).toHaveLength(1);
    expect(buttons(COPY.withdraw)).toHaveLength(1);
  });
});
