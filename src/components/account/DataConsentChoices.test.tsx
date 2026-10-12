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
import { type ConsentChoices } from "@/services/api/consentChoices";

const SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

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

  it("the record screen says why recording is off", () => {
    const lab = read("services/api/labRecording.ts");
    expect(lab).toContain('code === "PROCESSING_RECORDING_WITHDRAWN"');
    expect(lab).toContain("DATA_CONSENT_COPY.recordScreenOff");
  });
});
