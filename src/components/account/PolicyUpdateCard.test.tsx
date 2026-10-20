// @vitest-environment jsdom
/*
 * STORY    As a speaker, I want a "what's changed" card only when a newer
 *          policy replaced mine, opening the normal acceptance screen, so
 *          that I can re-accept easily.
 * OUTCOME
 *   O1  Card shown when I accepted an earlier version; Accept opens the
 *       ordinary acceptance screen; accepting there hides the card.
 *   O2  No card when my receipt is current or I never agreed before.
 * PROVES   O1 -> "offers the update and opens the ordinary acceptance screen"
 *          O2 -> "shows nothing when %s"
 * WHY      Founder 2026-09-28, decision 21.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchAuthorization = vi.fn();
vi.mock("@/services/api/processingAuthorization", () => ({
  fetchAuthorization: () => fetchAuthorization(),
}));
vi.mock("@/components/willab/Phase1AcceptanceFlow", () => ({
  default: ({ onAccepted }: { onAccepted: () => void }) =>
    createElement("button", { "data-testid": "acceptance-flow", onClick: onAccepted }, "flow"),
}));

import PolicyUpdateCard from "./PolicyUpdateCard";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";

const POLICY = { policyVersion: "phase1-2026.2" };
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  fetchAuthorization.mockReset();
});

async function mount(status: unknown, onAccepted = vi.fn()) {
  fetchAuthorization.mockResolvedValue(status);
  await act(async () => {
    root.render(createElement(PolicyUpdateCard, { onAccepted }));
  });
  return onAccepted;
}

describe("the policy update card", () => {
  it.each([
    ["my receipt is current", { kind: "authorized", policy: POLICY }],
    [
      "I never agreed before",
      {
        kind: "acceptance_required", policy: POLICY,
        code: "PROCESSING_AUTHORIZATION_REQUIRED", acceptedEarlierVersion: false,
      },
    ],
  ])("shows nothing when %s", async (_why, status) => {
    await mount(status);
    expect(fetchAuthorization).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="policy-update-card"]')).toBeNull();
    expect(host.textContent).toBe("");
  });

  it("offers the update and opens the ordinary acceptance screen", async () => {
    const onAccepted = await mount({
      kind: "acceptance_required", policy: POLICY,
      code: "PROCESSING_AUTHORIZATION_REQUIRED", acceptedEarlierVersion: true,
    });
    expect(host.textContent).toContain(COPY.updateTitle);
    const accept = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent === COPY.updateAccept,
    );
    await act(async () => accept?.click());
    const flow = host.querySelector('[data-testid="acceptance-flow"]') as HTMLButtonElement;
    expect(flow).not.toBeNull();
    await act(async () => flow.click());
    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="policy-update-card"]')).toBeNull();
  });
});
