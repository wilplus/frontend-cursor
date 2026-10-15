// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The policy update prompt (founder 2026-10-15).                            */
/*                                                                            */
/*  Someone who accepted an earlier Terms and Privacy Policy is never left   */
/*  unable to use the app:                                                    */
/*    1. the app opens with the prompt, and one tap writes the receipt with   */
/*       the country they gave last time;                                     */
/*    2. a Take refused for an out-of-date acceptance shows the prompt and    */
/*       processes once it is accepted;                                       */
/*    3. when the last country is no longer allowed, Accept opens the full    */
/*       consent screens instead of choosing for them.                        */
/* -------------------------------------------------------------------------- */
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AuthorizationStatus,
  ProcessingPolicy,
} from "@/services/api/processingAuthorization";

const io = vi.hoisted(() => ({
  takeAuthorization: vi.fn(),
  fetchAuthorization: vi.fn(),
  acceptAuthorization: vi.fn(),
  fetchConsentChoices: vi.fn(),
}));

vi.mock("@/services/api/bootPrefetch", () => ({ takeAuthorization: io.takeAuthorization }));
vi.mock("@/services/api/processingAuthorization", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAuthorization: io.fetchAuthorization,
  acceptAuthorization: io.acceptAuthorization,
  recordAiNoticeRendered: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/services/api/consentChoices", () => ({ fetchConsentChoices: io.fetchConsentChoices }));
vi.mock("./Phase1AcceptanceFlow", () => ({
  default: () => createElement("div", { "data-testid": "acceptance-flow" }),
}));

import Phase1AcceptanceGate from "./Phase1AcceptanceGate";
import { POLICY_UPDATE_COPY, usePolicyUpdate } from "./PolicyUpdate";

const POLICY: ProcessingPolicy = {
  policyId: "policy-uuid",
  policyVersion: "phase1-2026-10-15-3.6",
  terms: { version: "terms-3.6", copy: "T", sha256: "a".repeat(64) },
  privacy: { version: "privacy-3.6", copy: "P", sha256: "b".repeat(64) },
  aiNotice: { version: "ai-3.2", copy: "N", sha256: "c".repeat(64) },
  agreementCopy: "I have read the Terms of Service and the Privacy Policy and I agree to them.",
  agreementCopySha256: "d".repeat(64),
  allowedCountries: ["pl", "de", "us"],
  minimumAge: 18,
  aiNoticeRendered: true,
};

const update = (priorCountry: string | null = "pl"): AuthorizationStatus => ({
  kind: "acceptance_required",
  policy: POLICY,
  code: "PROCESSING_AUTHORIZATION_REQUIRED",
  acceptedEarlierVersion: true,
  priorCountry,
});

describe("policy update prompt", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    for (const fn of Object.values(io)) fn.mockReset();
    io.fetchConsentChoices.mockResolvedValue({ practiceOffered: false });
    io.acceptAuthorization.mockResolvedValue({
      kind: "accepted", receiptId: "r1", policyVersion: POLICY.policyVersion,
    });
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const flush = () => act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
  const button = (label: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);

  async function mount(first: AuthorizationStatus, child: React.ReactElement) {
    io.takeAuthorization.mockResolvedValue(first);
    act(() => {
      root.render(createElement(Phase1AcceptanceGate, null, child));
    });
    await flush();
  }

  it("opens the app with the prompt; one tap accepts with the country given last time", async () => {
    await mount(update("pl"), createElement("p", null, "THE LOUNGE"));
    expect(document.body.textContent).toContain(POLICY_UPDATE_COPY.title);
    expect(document.body.textContent).toContain(POLICY.agreementCopy);
    expect(document.querySelector('[data-testid="acceptance-flow"]')).toBeNull();

    await act(async () => button(POLICY_UPDATE_COPY.accept)?.click());
    await flush();

    expect(io.acceptAuthorization).toHaveBeenCalledTimes(1);
    expect(io.acceptAuthorization.mock.calls[0][0]).toMatchObject({
      policy: POLICY,
      countryOfResidence: "pl",
      optionalPurposes: [],
    });
    expect(document.body.textContent).not.toContain(POLICY_UPDATE_COPY.title);
    expect(document.body.textContent).toContain("THE LOUNGE");
  });

  it("a Take refused for an out-of-date acceptance shows the prompt, then processes", async () => {
    const processAgain = vi.fn();
    function RefusedTake() {
      const policyUpdate = usePolicyUpdate();
      useEffect(() => {
        policyUpdate?.refused("PROCESSING_AUTHORIZATION_REQUIRED", processAgain);
        // Once, as the upload's answer arrives once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return createElement("p", null, "PROCESSING");
    }
    io.fetchAuthorization.mockResolvedValue(update("pl"));
    await mount({ kind: "authorized", policy: POLICY }, createElement(RefusedTake));
    expect(document.body.textContent).toContain(POLICY_UPDATE_COPY.title);

    await act(async () => button(POLICY_UPDATE_COPY.accept)?.click());
    await flush();

    expect(processAgain).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain(POLICY_UPDATE_COPY.title);
  });

  it("opens the full consent screens when the last country is no longer allowed", async () => {
    await mount(update("fr"), createElement("p", null, "THE LOUNGE"));
    await act(async () => button(POLICY_UPDATE_COPY.accept)?.click());
    await flush();
    expect(io.acceptAuthorization).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="acceptance-flow"]')).not.toBeNull();
  });
});
