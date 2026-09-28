// @vitest-environment jsdom
/* "What's changed since you agreed" (founder 2026-09-28, decision 21): shown
   only when a newer policy replaced the one this person accepted, and it opens
   the ordinary acceptance screen. */
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
  it("stays dark while the agreement is current", async () => {
    await mount({ kind: "authorized", policy: POLICY });
    expect(host.querySelector('[data-testid="policy-update-card"]')).toBeNull();
  });

  it("is not shown to someone who never agreed", async () => {
    await mount({
      kind: "acceptance_required", policy: POLICY,
      code: "PROCESSING_AUTHORIZATION_REQUIRED", acceptedEarlierVersion: false,
    });
    expect(host.querySelector('[data-testid="policy-update-card"]')).toBeNull();
  });

  it("offers the update and opens the ordinary acceptance screen", async () => {
    const onAccepted = await mount({
      kind: "acceptance_required", policy: POLICY,
      code: "PROCESSING_AUTHORIZATION_REQUIRED", acceptedEarlierVersion: true,
    });
    expect(host.textContent).toContain("What’s changed since you agreed");
    const accept = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent === "Accept the update",
    );
    await act(async () => accept?.click());
    const flow = host.querySelector('[data-testid="acceptance-flow"]') as HTMLButtonElement;
    expect(flow).not.toBeNull();
    await act(async () => flow.click());
    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="policy-update-card"]')).toBeNull();
  });
});
