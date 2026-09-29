// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ModelImprovementConsent from "./ModelImprovementConsent";
import {
  fetchMlc2Consent,
  grantMlc2Consent,
  withdrawMlc2Consent,
  type Mlc2ConsentStatus,
} from "@/services/api/mlc2Consent";

vi.mock("@/services/api/mlc2Consent", async (load) => {
  const actual = await load<typeof import("@/services/api/mlc2Consent")>();
  return {
    ...actual,
    fetchMlc2Consent: vi.fn(),
    grantMlc2Consent: vi.fn(),
    withdrawMlc2Consent: vi.fn(),
  };
});
vi.mock("@/components/willab/LoadingState", () => ({
  default: () => createElement("span", null, "loading"),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    createElement("a", { href }, children),
}));

const REQUIRED: Mlc2ConsentStatus = {
  applicable: true,
  configured: true,
  granted: false,
  speaker_bound: false,
  consent_policy_version: "mlc2-consent-v3",
  required_for_service: true,
  bundled_ui: true,
  approval_reference: "approval-1",
  approved_copy_sha256: "c".repeat(64),
  onboarding_copy: "The policy text.\n\nI agree to pooled model improvement.",
  terms_version: "t1",
  privacy_policy_version: "p1",
  article_6_basis: "consent",
  article_9_treatment: "9(2)(a)_when_special_category",
};

let root: Root;
let container: HTMLDivElement;

async function render() {
  await act(async () => {
    root.render(createElement(ModelImprovementConsent));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("the model-improvement consent page (Q7)", () => {
  it("shows the policy text and an initially unselected checkbox; agree is disabled until ticked", async () => {
    vi.mocked(fetchMlc2Consent).mockResolvedValue(REQUIRED);
    await render();
    expect(container.textContent).toContain("The policy text.");
    expect(container.textContent).toContain("I agree to pooled model improvement.");
    const box = container.querySelector<HTMLInputElement>('[data-testid="mi-checkbox"]')!;
    const agree = container.querySelector<HTMLButtonElement>('[data-testid="mi-agree"]')!;
    expect(box.checked).toBe(false);
    expect(agree.disabled).toBe(true);
    expect(grantMlc2Consent).not.toHaveBeenCalled();
  });

  it("records the consent only through the explicit action, with the exact status", async () => {
    vi.mocked(fetchMlc2Consent).mockResolvedValue(REQUIRED);
    vi.mocked(grantMlc2Consent).mockResolvedValue({ ...REQUIRED, granted: true, speaker_bound: true });
    await render();
    const box = container.querySelector<HTMLInputElement>('[data-testid="mi-checkbox"]')!;
    await act(async () => {
      box.click();
    });
    const agree = container.querySelector<HTMLButtonElement>('[data-testid="mi-agree"]')!;
    expect(agree.disabled).toBe(false);
    await act(async () => {
      agree.click();
    });
    expect(grantMlc2Consent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(grantMlc2Consent).mock.calls[0][0]).toBe(REQUIRED);
    expect(container.querySelector('[data-testid="mi-granted"]')).not.toBeNull();
  });

  it("an account the ring row does not reach sees the not-applicable line and no checkbox", async () => {
    vi.mocked(fetchMlc2Consent).mockResolvedValue({ ...REQUIRED, applicable: false });
    await render();
    expect(container.querySelector('[data-testid="mi-not-applicable"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mi-checkbox"]')).toBeNull();
    expect(container.querySelector('a[href="/account/data-consent"]')).not.toBeNull();
  });

  it("a granted consent shows the granted line and can be withdrawn explicitly", async () => {
    vi.mocked(fetchMlc2Consent).mockResolvedValue({ ...REQUIRED, granted: true });
    vi.mocked(withdrawMlc2Consent).mockResolvedValue({ ...REQUIRED, granted: false });
    await render();
    expect(container.querySelector('[data-testid="mi-granted"]')).not.toBeNull();
    const withdraw = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "[founder copy] Withdraw");
    expect(withdraw).toBeDefined();
    await act(async () => {
      withdraw!.click();
    });
    expect(withdrawMlc2Consent).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="mi-checkbox"]')).not.toBeNull();
  });

  it("every new string on the page is a founder placeholder; the form's strings are the gate's", async () => {
    const { MODEL_IMPROVEMENT_COPY } = await import("@/lib/legal/modelImprovementCopy");
    const placeholders = ["title", "notApplicable", "granted", "withdraw", "withdrawing", "declined", "back"] as const;
    for (const key of placeholders) {
      expect(MODEL_IMPROVEMENT_COPY[key].startsWith("[founder copy] ")).toBe(true);
    }
    const { readFileSync } = await import("node:fs");
    const gate = readFileSync("src/components/willab/Mlc2FounderConsentGate.tsx", "utf8");
    for (const key of ["agree", "doNotAgree", "reviewAgain", "errorTitle", "tryAgain", "privacy", "terms"] as const) {
      expect(gate).toContain(MODEL_IMPROVEMENT_COPY[key].replace("'", "&apos;"));
    }
  });
});
