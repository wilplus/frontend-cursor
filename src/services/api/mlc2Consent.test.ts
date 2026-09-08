import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchMlc2Consent,
  grantMlc2Consent,
  type Mlc2ConsentStatus,
} from "./mlc2Consent";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const configuredStatus: Mlc2ConsentStatus = {
  applicable: true,
  configured: true,
  granted: false,
  speaker_bound: true,
  consent_policy_version: "policy-v1",
  required_for_service: true,
  bundled_ui: true,
  approval_reference: "approval-v1",
  approved_copy_sha256: "a".repeat(64),
  onboarding_copy: "Review\n\nI agree",
  terms_version: "1.2",
  privacy_policy_version: "1.2",
  article_6_basis: "6(1)(a)",
  article_9_treatment: "not_applicable",
};

describe("MLC-2 consent status", () => {
  it("treats the explicit disabled GET as not currently applicable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      code: "PHASE2_DISABLED",
      error: "Pooled datasets, training, and promotion are not active.",
    }), { status: 410, headers: { "Content-Type": "application/json" } })));

    await expect(fetchMlc2Consent()).resolves.toMatchObject({
      applicable: false,
      configured: false,
      granted: false,
    });
  });

  it("does not reinterpret a different 410 as a safe pass", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      code: "PURPOSE_NOT_OPERATIONAL",
      error: "This feature is not available yet.",
    }), { status: 410, headers: { "Content-Type": "application/json" } })));

    await expect(fetchMlc2Consent()).rejects.toThrow(
      "This feature is not available yet.",
    );
  });

  it("keeps consent writes fail-closed when Phase 2 is disabled", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      code: "PHASE2_DISABLED",
      error: "Pooled datasets, training, and promotion are not active.",
    }), { status: 410, headers: { "Content-Type": "application/json" } })));

    await expect(grantMlc2Consent(configuredStatus)).rejects.toThrow(
      "Pooled datasets, training, and promotion are not active.",
    );
  });
});
