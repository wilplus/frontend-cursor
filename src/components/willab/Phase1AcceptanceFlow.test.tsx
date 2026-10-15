// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  CHOOSING A COUNTRY CARRIES YOU FORWARD. TICKING A CONSENT DOES NOT.        */
/*  (founder 2026-09-23: auto-transition after selecting the country, like     */
/*  Typeform)                                                                  */
/*                                                                            */
/*  Both halves are the test. The country is a fact about the user that        */
/*  decides which law applies, and asking for a second tap to confirm a tap    */
/*  buys nothing — so it advances on its own.                                  */
/*                                                                            */
/*  The two attestations on `confirm` are the AGREEMENT. Auto-advancing off a  */
/*  tick box is exactly how a mis-tap becomes a recorded receipt, and a        */
/*  receipt naming bytes the user never meant to accept is worse than no       */
/*  receipt, because it looks like evidence. If somebody later generalises     */
/*  the auto-advance "for consistency", the second test here is what stops     */
/*  them.                                                                      */
/* -------------------------------------------------------------------------- */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api/processingAuthorization", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  recordAiNoticeRendered: vi.fn(async () => undefined),
  acceptAuthorization: vi.fn(async () => ({ kind: "accepted" as const })),
}));

const consent = vi.hoisted(() => ({ offered: true }));
vi.mock("@/services/api/consentChoices", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchConsentChoices: vi.fn(async () => ({
    hasReceipt: false, personalisedPractice: false, sensitiveInformation: true,
    practiceErasureComplete: null, practiceOffered: consent.offered,
  })),
}));

const training = vi.hoisted(() => ({
  state: null as null | {
    available: boolean; active: boolean; policyVersion: string; copy: string; copySha256: string;
  },
  set: vi.fn(),
}));
vi.mock("@/services/api/trainingConsent", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTrainingConsent: vi.fn(async () => training.state),
  setTrainingConsent: training.set,
}));

import Phase1AcceptanceFlow from "./Phase1AcceptanceFlow";
import { acceptAuthorization } from "@/services/api/processingAuthorization";
import {
  type ProcessingPolicy,
} from "@/services/api/processingAuthorization";

const POLICY: ProcessingPolicy = {
  policyId: "policy-uuid",
  policyVersion: "phase1-test",
  terms: { version: "2.0", copy: "TERMS BYTES", sha256: "a".repeat(64) },
  privacy: { version: "2.0", copy: "PRIVACY BYTES", sha256: "b".repeat(64) },
  aiNotice: { version: "1.0", copy: "NOTICE BYTES", sha256: "c".repeat(64) },
  agreementCopy: "I agree and continue",
  agreementCopySha256: "d".repeat(64),
  allowedCountries: ["pl", "de"],
  minimumAge: 18,
  aiNoticeRendered: true,
};

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
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

/** notice -> terms -> privacy -> ai -> country, the way a first-timer walks.
 *  `priorCountry` is what a re-accepting person gave last time (Q21 A). */
async function walkToCountry(priorCountry?: string | null) {
  await act(async () => {
    root.render(
      createElement(Phase1AcceptanceFlow, {
        policy: POLICY,
        priorCountry,
        onAccepted: () => {},
        onStale: () => {},
      }),
    );
  });
  await click("Continue");        // notice -> terms
  await click("Continue");        // terms  -> privacy
  await click("Continue");        // privacy-> ai
  await click("Continue");        // ai     -> country
  expect(host.textContent).toContain("Where do you live?");
}

describe("the country step", () => {
  it("advances on its own once a country is chosen", async () => {
    await walkToCountry();

    await click("Poland");
    // The choice is visible first — the step has not moved yet.
    expect(host.textContent).toContain("Where do you live?");

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(host.textContent).toContain("Three things to confirm");
  });
});

describe("the confirm step", () => {
  it("NEVER advances on its own — consent stays a deliberate act", async () => {
    await walkToCountry();
    await click("Poland");
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(host.textContent).toContain("Three things to confirm");

    // Tick the age attestation and let far more time pass than the country
    // step needs. Nothing may move.
    await click("I am 18");
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(host.textContent).toContain("Three things to confirm");
  });
});

/* -------------------------------------------------------------------------- */
/*  EVERY STEP OPENS AT ITS TOP AND FADES IN (consent lock 2026-10-07; build  */
/*  plan D-CS-1). The gate's viewport scroller outlives the steps: a step     */
/*  reached from far down the country list used to open scrolled past its    */
/*  voice mark and heading.                                                   */
/* -------------------------------------------------------------------------- */

describe("each step opens at its top", () => {
  let scroller: HTMLDivElement;
  beforeEach(() => {
    // The gate's own scroller, as Phase1AcceptanceGate wraps the flow.
    scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    document.body.appendChild(scroller);
    scroller.appendChild(host);
  });
  afterEach(() => scroller.remove());

  it("resets it on every step change, Back and the documents included", async () => {
    await walkToCountry();
    for (const [action, heading] of [
      ["Back", "How AI is used here"],
      ["Continue", "Where do you live?"],
    ] as const) {
      scroller.scrollTop = 600;
      await click(action);
      expect(host.querySelector("h1")?.textContent).toBe(heading);
      expect(scroller.scrollTop).toBe(0);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  WIL-8 and WIL-9 (founder 2026-10-15).                                      */
/* -------------------------------------------------------------------------- */

async function walkToConfirm() {
  await walkToCountry();
  await click("Poland");
  await act(async () => {
    vi.advanceTimersByTime(400);
  });
}

describe("the training choice as the third thing", () => {
  beforeEach(() => {
    consent.offered = false;
    training.state = {
      available: true, active: false, policyVersion: "training-only-v2",
      copy: "Use my practice text to train.", copySha256: "e".repeat(64),
    };
    training.set.mockReset();
    training.set.mockResolvedValue({ ...training.state, active: true });
    vi.mocked(acceptAuthorization).mockClear();
  });
  afterEach(() => {
    consent.offered = true;
    training.state = null;
  });

  it("is optional: agreeing without it sends no training yes", async () => {
    await walkToConfirm();
    expect(host.textContent).toContain("Three things to confirm");
    await click("I am 18");
    await click("I agree that");
    await click("Agree and continue");
    expect(acceptAuthorization).toHaveBeenCalledTimes(1);
    expect(training.set).not.toHaveBeenCalled();
  });

  it("ticked, sends the yes against the sentence shown, after the agreement", async () => {
    await walkToConfirm();
    await click("I am 18");
    await click("I agree that");
    await click("Yes, make it so much better");
    await click("Agree and continue");
    expect(acceptAuthorization).toHaveBeenCalledTimes(1);
    expect(training.set).toHaveBeenCalledWith(true, training.state);
  });
});
