// @vitest-environment jsdom
/*
STORY    As a speaker whose current consent is missing, I want the ordinary
         consent screen to block the app until I accept, so that an older
         receipt can never let me keep using the app.
OUTCOME
  O1  Opening with a newer policy shows the full consent screen and never the
      Lounge or dismissible update prompt.
  O2  A Take refused after a policy change opens the same screen and resumes
      only after acceptance succeeds.
  O3  The refusal blocks synchronously and stays blocked if the policy read
      fails; a slow network never creates a usable gap.
PROVES   O1 -> "a newer policy blocks the app in the full consent flow"
         O2 -> "a mid-session policy refusal blocks and resumes only after acceptance"
         O3 -> "a known refusal blocks before the policy read completes"
WHY      Founder 2026-11-18, backend N664.
*/
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
}));

vi.mock("@/services/api/bootPrefetch", () => ({ takeAuthorization: io.takeAuthorization }));
vi.mock("@/services/api/processingAuthorization", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAuthorization: io.fetchAuthorization,
  recordAiNoticeRendered: vi.fn().mockResolvedValue(true),
}));
vi.mock("./Phase1AcceptanceFlow", () => ({
  default: ({ onAccepted }: { onAccepted: () => void }) => createElement(
    "div",
    { "data-testid": "acceptance-flow" },
    createElement("button", { type: "button", onClick: onAccepted }, "ACCEPT CURRENT POLICY"),
  ),
}));

import Phase1AcceptanceGate from "./Phase1AcceptanceGate";
import { usePolicyUpdate } from "./PolicyUpdate";

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

describe("current-policy consent gate", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    for (const fn of Object.values(io)) fn.mockReset();
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const flush = () => act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
  const accept = () => [...document.querySelectorAll("button")]
    .find((b) => b.textContent?.trim() === "ACCEPT CURRENT POLICY");

  async function mount(first: AuthorizationStatus, child: React.ReactElement) {
    io.takeAuthorization.mockResolvedValue(first);
    act(() => {
      root.render(createElement(Phase1AcceptanceGate, null, child));
    });
    await flush();
  }

  it("a newer policy blocks the app in the full consent flow", async () => {
    await mount(update("pl"), createElement("p", null, "THE LOUNGE"));
    expect(document.querySelector('[data-testid="acceptance-flow"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain("THE LOUNGE");
  });

  it("a mid-session policy refusal blocks and resumes only after acceptance", async () => {
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
    expect(document.querySelector('[data-testid="acceptance-flow"]')).not.toBeNull();
    const gated = document.querySelector('[data-policy-gated="true"]');
    expect(gated).not.toBeNull();
    expect(gated?.classList.contains("hidden")).toBe(true);
    expect((gated as HTMLDivElement).inert).toBe(true);
    expect(processAgain).not.toHaveBeenCalled();

    await act(async () => accept()?.click());
    await flush();
    expect(processAgain).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-testid="acceptance-flow"]')).toBeNull();
  });

  it("a known refusal blocks before the policy read completes", async () => {
    let resolveRead!: (status: AuthorizationStatus) => void;
    io.fetchAuthorization.mockReturnValue(new Promise<AuthorizationStatus>((resolve) => {
      resolveRead = resolve;
    }));
    function RefusedTake() {
      const policyUpdate = usePolicyUpdate();
      useEffect(() => {
        policyUpdate?.refused("PROCESSING_POLICY_STALE");
        // Once, as the refusal arrives once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return createElement("p", null, "PROCESSING");
    }

    await mount({ kind: "authorized", policy: POLICY }, createElement(RefusedTake));
    const gated = document.querySelector('[data-policy-gated="true"]');
    expect(gated?.classList.contains("hidden")).toBe(true);
    expect((gated as HTMLDivElement).inert).toBe(true);
    expect(document.querySelector('[data-testid="acceptance-flow"]')).toBeNull();

    resolveRead({ kind: "error", message: "offline" });
    await flush();
    expect(document.querySelector('[data-policy-gated="true"]')).not.toBeNull();
  });
});
