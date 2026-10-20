// @vitest-environment jsdom
/*
STORY    As a speaker, I want turning off practice or withdrawing sensitive
         information to ask first and take effect only on confirm, so that I
         control my data (consent, on the record step of the loop).
OUTCOME
  O1  Turning practice off asks first; nothing is sent until I confirm, then
      the page says practice is off.
  O2  Turning practice back on needs no confirm and is sent at once.
  O3  Withdrawing sensitive information asks first, then says recording is
      off; agreeing again is sent without a confirm.
  O4  A failed save says so and changes nothing on the page.
  O5  Once withdrawn, the record screen's upload answer says why recording is
      off and where to turn it back on (the recording service's message).
PROVES   O1 -> "turning practice off asks first, and sends nothing until confirmed"
         O2 -> "turning practice back on is sent at once, with no confirm"
         O3 -> "withdrawing asks first, then stops recording, and can be agreed again"
         O4 -> "a failed save says so and changes nothing"
         O5 -> "the record screen says why recording is off"
WHY      Founder 2026-09-25, Data & consent page (F2, E2-E5). Telling the coach
         that practice is off is the backend's job (no frontend surface here).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchConsentChoices: vi.fn(),
  setConsentChoice: vi.fn(),
}));

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));

vi.mock("@/services/api/consentChoices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/consentChoices")>();
  return { ...actual, ...api };
});

import DataConsentChoices from "./DataConsentChoices";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";
import { type ConsentChoices } from "@/services/api/consentChoices";
import { submitLabRecording } from "@/services/api/labRecording";

function choices(over: Partial<ConsentChoices> = {}): ConsentChoices {
  return {
    hasReceipt: true,
    personalisedPractice: true,
    sensitiveInformation: true,
    practiceErasureComplete: null,
    practiceOffered: true,
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
  vi.unstubAllGlobals();
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => { await Promise.resolve(); });
const section = (title: string) =>
  container.querySelector(`section[aria-label="${title}"]`) as HTMLElement;
const inSection = (title: string, label: string) =>
  Array.from(section(title).querySelectorAll("button")).find((b) => b.textContent === label);

async function renderWith(value: ConsentChoices | null) {
  api.fetchConsentChoices.mockResolvedValue(value);
  act(() => root.render(createElement(DataConsentChoices)));
  await flush();
}

describe("personalised practice", () => {
  it("turning practice off asks first, and sends nothing until confirmed", async () => {
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

  it("turning practice back on is sent at once, with no confirm", async () => {
    await renderWith(choices({ personalisedPractice: false }));
    api.setConsentChoice.mockResolvedValue(choices());
    await act(async () => inSection(COPY.practiceTitle, COPY.turnOn)?.click());
    await flush();
    expect(container.textContent).not.toContain(COPY.turnOffConfirm);
    expect(api.setConsentChoice).toHaveBeenCalledWith("personalised_practice", true);
    expect(container.textContent).toContain(COPY.practiceOn);
  });

  it("a failed save says so and changes nothing", async () => {
    await renderWith(choices());
    api.setConsentChoice.mockResolvedValue(null);
    await act(async () => inSection(COPY.practiceTitle, COPY.turnOff)?.click());
    const confirm = Array.from(section(COPY.practiceTitle)
      .querySelectorAll<HTMLButtonElement>('[role="group"] button')).find((b) => b.textContent === COPY.turnOff);
    await act(async () => confirm?.click());
    await flush();
    expect(api.setConsentChoice).toHaveBeenCalledWith("personalised_practice", false);
    expect(section(COPY.practiceTitle).querySelector('[role="alert"]')?.textContent).toBe(COPY.failed);
    expect(container.textContent).not.toContain(COPY.practiceOff);
    // Still on: the button still offers to turn it off.
    expect(inSection(COPY.practiceTitle, COPY.turnOff)).toBeTruthy();
  });
});

describe("sensitive information", () => {
  it("withdrawing asks first, then stops recording, and can be agreed again", async () => {
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
    expect(container.textContent).not.toContain(COPY.recordingOff);
  });
});

describe("the record screen", () => {
  it("the record screen says why recording is off", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ code: "PROCESSING_RECORDING_WITHDRAWN", error: "forbidden" }),
    }) as unknown as Response));
    const result = await submitLabRecording({
      audioBlob: new Blob(["a"], { type: "audio/webm" }),
      projectId: "arc-1",
      uploadIdempotencyKey: "up-1",
      durationSec: 30,
      topic: "Board pitch",
    });
    expect(result).toMatchObject({
      kind: "error",
      code: "PROCESSING_RECORDING_WITHDRAWN",
      message: COPY.recordScreenOff,
    });
  });
});
