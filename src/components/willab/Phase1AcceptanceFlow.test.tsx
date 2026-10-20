// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE ONE ACCEPTANCE SCREEN (founder 2026-10-18).                            */
/*                                                                            */
/*  What a speaker, and the receipt, depend on: the button stays closed until  */
/*  a country is chosen and the recordings consent is ticked; nothing on the   */
/*  screen advances on its own, because a receipt naming bytes the user never  */
/*  meant to accept is worse than an extra tap; the documents are reachable    */
/*  before the decision and never gate it; "Do not agree" records nothing and  */
/*  leaves the way back open.                                                  */
/* -------------------------------------------------------------------------- */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api/processingAuthorization", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  recordAiNoticeRendered: vi.fn(async () => undefined),
  acceptAuthorization: vi.fn(async () => ({ kind: "accepted" as const })),
}));

import Phase1AcceptanceFlow from "./Phase1AcceptanceFlow";
import {
  acceptAuthorization,
  recordAiNoticeRendered,
  type ProcessingPolicy,
} from "@/services/api/processingAuthorization";

const POLICY: ProcessingPolicy = {
  policyId: "policy-uuid",
  policyVersion: "phase1-test",
  terms: { version: "2.0", copy: "TERMS BYTES", sha256: "a".repeat(64) },
  privacy: { version: "2.0", copy: "PRIVACY BYTES", sha256: "b".repeat(64) },
  aiNotice: { version: "1.0", copy: "NOTICE BYTES", sha256: "c".repeat(64) },
  agreementCopy: "By tapping Agree and continue you accept the Terms of Service.",
  agreementCopySha256: "d".repeat(64),
  allowedCountries: ["pl", "de"],
  minimumAge: 18,
  aiNoticeRendered: true,
};

let root: Root;
let host: HTMLDivElement;
const accepted = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  accepted.mockReset();
  vi.mocked(acceptAuthorization).mockClear();
  vi.mocked(recordAiNoticeRendered).mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function buttonSaying(text: string): HTMLButtonElement {
  const match = [...host.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").trim().startsWith(text),
  );
  if (!match) throw new Error(`no button starting "${text}" in: ${host.textContent}`);
  return match as HTMLButtonElement;
}

const click = async (text: string) =>
  act(async () => {
    buttonSaying(text).click();
  });

const chooseCountry = async (code: string) =>
  act(async () => {
    const select = host.querySelector("select") as HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(select, code);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

async function show(priorCountry?: string | null) {
  await act(async () => {
    root.render(
      createElement(Phase1AcceptanceFlow, {
        policy: POLICY,
        priorCountry,
        onAccepted: accepted,
        onStale: () => {},
      }),
    );
  });
}

describe("the one screen", () => {
  it("shows the agreement bytes, the documents and the one tick, with the button closed", async () => {
    await show();
    expect(host.textContent).toContain(POLICY.agreementCopy);
    expect(host.textContent).toContain("Choose your country *");
    expect(host.textContent).toContain("I agree that WillpowerLab may process my recordings. *");
    expect(buttonSaying("Agree and continue").disabled).toBe(true);
  });

  it("opens only once a country is chosen AND the recordings consent is ticked, and never on its own", async () => {
    await show();
    await chooseCountry("pl");
    expect(buttonSaying("Agree and continue").disabled).toBe(true);
    await click("I agree that");
    expect(buttonSaying("Agree and continue").disabled).toBe(false);

    // Consent stays a deliberate act: nothing moves until the button.
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(acceptAuthorization).not.toHaveBeenCalled();
    expect(accepted).not.toHaveBeenCalled();

    await click("Agree and continue");
    expect(acceptAuthorization).toHaveBeenCalledTimes(1);
    expect(vi.mocked(acceptAuthorization).mock.calls[0][0]).toMatchObject({
      countryOfResidence: "pl",
      optionalPurposes: [],
    });
    expect(accepted).toHaveBeenCalledTimes(1);
  });

  it("prefills the person's own earlier country and still lets them change it", async () => {
    await show("de");
    expect((host.querySelector("select") as HTMLSelectElement).value).toBe("de");
    await chooseCountry("pl");
    expect((host.querySelector("select") as HTMLSelectElement).value).toBe("pl");
  });
});

describe("the documents", () => {
  it("open in a window from the screen, tick their name, and never gate the button", async () => {
    await show();
    await click("Privacy Policy");
    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("PRIVACY BYTES");
    expect(dialog?.textContent).toContain("Version 2.0");
    await click("Continue");
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(buttonSaying("Privacy Policy").textContent).toContain("read ✓");
    // Opening the documents is not what opens the button.
    expect(buttonSaying("Agree and continue").disabled).toBe(true);
  });

  it("records the AI notice exposure when the notice is opened", async () => {
    await show();
    expect(recordAiNoticeRendered).not.toHaveBeenCalled();
    await click("How AI is used here");
    expect(recordAiNoticeRendered).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordAiNoticeRendered).mock.calls[0][0]).toMatchObject({
      aiNoticeVersion: "1.0",
      surface: "phase1_acceptance",
    });
  });
});

describe("Do not agree", () => {
  it("records nothing and leaves the way back to the screen and the documents", async () => {
    await show();
    await click("Do not agree");
    expect(host.textContent).toContain("Nothing was recorded");
    expect(acceptAuthorization).not.toHaveBeenCalled();
    await click("Read the documents again");
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("TERMS BYTES");
    await click("Continue");
    expect(host.textContent).toContain("Choose your country *");
  });
});
