// @vitest-environment jsdom
/*
STORY    As a speaker, I want model-improvement consent recorded only when I
         tick and press Agree, so that nothing is agreed on my behalf (consent).
OUTCOME
  O1  Nothing is sent on load; Agree stays off until the box is ticked, and
      pressing it unticked sends nothing.
  O2  Ticked, Agree sends the grant once, against the exact status shown,
      and the page says consent is given.
  O3  A grant the backend does not confirm is not shown as given.
PROVES   O1 -> "sends nothing until the box is ticked"
         O2 -> "records the consent only through the explicit action, with the exact status"
         O3 -> "a grant the backend does not confirm is not shown as given"
WHY      Q7 (founder 2026-09-29), L3: only the checkbox here records a consent.
*/

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ModelImprovementConsent from "./ModelImprovementConsent";
import {
  fetchMlc2Consent,
  grantMlc2Consent,
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
  it("sends nothing until the box is ticked", async () => {
    vi.mocked(fetchMlc2Consent).mockResolvedValue(REQUIRED);
    await render();
    const agree = container.querySelector<HTMLButtonElement>('[data-testid="mi-agree"]')!;
    expect(container.querySelector<HTMLInputElement>('[data-testid="mi-checkbox"]')!.checked).toBe(false);
    expect(agree.disabled).toBe(true);
    await act(async () => {
      agree.click();
    });
    expect(grantMlc2Consent).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="mi-granted"]')).toBeNull();
  });

  it("a grant the backend does not confirm is not shown as given", async () => {
    vi.mocked(fetchMlc2Consent).mockResolvedValue(REQUIRED);
    vi.mocked(grantMlc2Consent).mockResolvedValue({ ...REQUIRED, granted: false });
    await render();
    await act(async () => {
      container.querySelector<HTMLInputElement>('[data-testid="mi-checkbox"]')!.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="mi-agree"]')!.click();
    });
    expect(grantMlc2Consent).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="mi-granted"]')).toBeNull();
    expect(container.textContent).toContain("Consent was not confirmed.");
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
});
