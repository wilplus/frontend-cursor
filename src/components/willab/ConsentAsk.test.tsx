// @vitest-environment jsdom
/*
STORY    As a speaker asked for consent in the chat, I want Yes to save it as
         the Data & consent page does and No to save nothing, so that my
         answer means what I chose.
OUTCOME
  O1  The card shows the question's own words and Read more.
  O2  Yes saves the consent and closes the ask.
  O3  No saves nothing and closes the ask.
PROVES   O1 -> "shows the question's own words with Read more"
         O2 -> "Yes saves the consent as the Data & consent page does"
         O3 -> "No saves nothing and closes the ask"
WHY      Founder 2026-10-18 (No | Yes in the chat).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchConsentChoices: vi.fn(),
  setConsentChoice: vi.fn(),
}));
vi.mock("@/services/api/consentChoices", () => api);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { ConsentAskActions } from "./ConsentAsk";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";

let container: HTMLDivElement;
let root: Root;
const onAnswered = vi.fn();
const onResolve = vi.fn();

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.clearAllMocks();
  const off = { hasReceipt: true, personalisedPractice: false, sensitiveInformation: false,
    practiceErasureComplete: null, practiceOffered: true };
  api.fetchConsentChoices.mockResolvedValue(off);
  api.setConsentChoice.mockResolvedValue({ ...off, sensitiveInformation: true });
  await act(async () => {
    root.render(createElement(ConsentAskActions, {
      consentKey: "sensitive_information", onOpened: vi.fn(), onAnswered, onResolve,
    }));
    await settle();
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const press = (label: string) =>
  act(async () => {
    [...container.querySelectorAll("button")].find((b) => b.textContent === label)!.click();
    await settle();
  });

describe("a consent ask in the chat", () => {
  it("shows the question's own words with Read more", () => {
    expect(container.textContent).toContain(COPY.sensitiveText);
    expect(container.textContent).toContain(COPY.readMore);
  });

  it("Yes saves the consent as the Data & consent page does", async () => {
    await press("Yes");
    expect(api.setConsentChoice).toHaveBeenCalledWith("sensitive_information", true);
    expect(onAnswered).toHaveBeenCalled();
    expect(onResolve).toHaveBeenCalled();
  });

  it("No saves nothing and closes the ask", async () => {
    await press("No");
    expect(api.setConsentChoice).not.toHaveBeenCalled();
    expect(onAnswered).toHaveBeenCalled();
    expect(onResolve).toHaveBeenCalled();
  });
});
