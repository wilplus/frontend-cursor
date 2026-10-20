// @vitest-environment jsdom
/*
STORY    As a speaker whose account is being deleted, I want to see the ended
         state, not the acceptance flow, and be let back in if I cancel, so
         that re-accepting never traps me; and as any speaker I want the
         consent gate to ask me only what is really mine to agree (consent).
OUTCOME
  O1  With the ended state on, a block shows the ended state, never the
      acceptance flow or the Lounge.
  O2  With it off, a block does what it did before: the acceptance flow when
      a policy came with it, otherwise the Lounge.
  O3  A cancelled deletion reads the status again and lets the person in.
  O4  A re-acceptance hands the flow the country given last time.
  O5  A signed-up guest is not asked to accept again: the claim comes first.
  O6  A refused identity blocks with Try again, which reads again; no active
      policy still passes (the gate fails open).
PROVES   O1 -> "shows the ended state for a block, never the acceptance flow or the Lounge"
         O2 -> "switched off, a block does what it did before"
         O3 -> "a cancelled deletion reads the status again, and lets the person back in"
         O4 -> "a re-acceptance hands the flow the country given last time"
         O5 -> "a signed-up guest is not asked to accept again: the claim comes before the read"
         O6 -> "a refused identity blocks, and Try again reads the status again"
WHY      Audit PLF-T1; founder 2026-10-05 (N48.4 Q19 A, Q21 A) and 2026-10-18.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AuthorizationStatus,
  ProcessingPolicy,
} from "@/services/api/processingAuthorization";

const flag = vi.hoisted(() => ({ ended: true }));
const io = vi.hoisted(() => ({
  takeAuthorization: vi.fn(),
  fetchAuthorization: vi.fn(),
  cancelAccountDeletion: vi.fn(),
  hasClaimableGuestOwner: vi.fn(),
  claimGuestProjects: vi.fn(),
}));

vi.mock("@/services/api/projects", () => ({
  hasClaimableGuestOwner: io.hasClaimableGuestOwner,
  claimGuestProjects: io.claimGuestProjects,
}));

vi.mock("@/lib/legal/leavingCopy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/legal/leavingCopy")>();
  return {
    ...actual,
    get ENDED_STATE_ENABLED() {
      return flag.ended;
    },
    // The cancel is pinned on in this file so the hand-back can be driven.
    ACCOUNT_DELETION_CANCEL_ENABLED: true,
  };
});
vi.mock("@/services/api/bootPrefetch", () => ({ takeAuthorization: io.takeAuthorization }));
vi.mock("@/services/api/processingAuthorization", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAuthorization: io.fetchAuthorization,
}));
vi.mock("@/services/api/accountDeletion", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  cancelAccountDeletion: io.cancelAccountDeletion,
}));
// The flow itself is pinned in Phase1AcceptanceFlow.test.tsx; here only
// whether the gate shows it, and with which country.
vi.mock("./Phase1AcceptanceFlow", () => ({
  default: (props: { priorCountry?: string | null }) =>
    createElement("div", { "data-testid": "acceptance-flow" }, `prior:${props.priorCountry ?? "none"}`),
}));

import Phase1AcceptanceGate, { gateStateFor } from "./Phase1AcceptanceGate";
import { LEAVING_COPY } from "@/lib/legal/leavingCopy";

const POLICY: ProcessingPolicy = {
  policyId: "policy-uuid",
  policyVersion: "phase1-test",
  terms: { version: "2.0", copy: "T", sha256: "a".repeat(64) },
  privacy: { version: "2.0", copy: "P", sha256: "b".repeat(64) },
  aiNotice: { version: "1.0", copy: "N", sha256: "c".repeat(64) },
  agreementCopy: "I agree",
  agreementCopySha256: "d".repeat(64),
  allowedCountries: ["pl", "de"],
  minimumAge: 18,
  aiNoticeRendered: true,
};

const PURGE = "0f8fad5b-d9cb-469f-a165-70867728950e";
const blocked = (over: Partial<Extract<AuthorizationStatus, { kind: "blocked" }>> = {}): AuthorizationStatus => ({
  kind: "blocked",
  code: "PROCESSING_SERVICE_BLOCKED",
  policy: POLICY,
  pendingDeletion: {
    purgeId: PURGE,
    kind: "account",
    projectId: null,
    completesAfter: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    cancellable: true,
  },
  ...over,
});

describe("<Phase1AcceptanceGate>", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    flag.ended = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    for (const fn of Object.values(io)) fn.mockReset();
    io.hasClaimableGuestOwner.mockReturnValue(false);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const flush = () => act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });

  async function mount(first: AuthorizationStatus) {
    io.takeAuthorization.mockResolvedValue(first);
    act(() => {
      root.render(createElement(Phase1AcceptanceGate, null, createElement("p", null, "THE LOUNGE")));
    });
    await flush();
  }

  it("shows the ended state for a block, never the acceptance flow or the Lounge", async () => {
    await mount(blocked());
    expect(host.querySelector('[data-testid="account-ended-state"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="acceptance-flow"]')).toBeNull();
    expect(host.textContent).not.toContain("THE LOUNGE");
  });

  it("switched off, a block does what it did before", async () => {
    flag.ended = false;
    await mount(blocked());
    expect(host.querySelector('[data-testid="acceptance-flow"]')?.textContent).toBe("prior:none");
    expect(host.querySelector('[data-testid="account-ended-state"]')).toBeNull();
    act(() => root.unmount());
    root = createRoot(host);
    await mount(blocked({ policy: null }));
    expect(host.textContent).toContain("THE LOUNGE");
    expect(host.querySelector('[data-testid="account-ended-state"]')).toBeNull();
  });

  it("a re-acceptance hands the flow the country given last time", async () => {
    await mount({
      kind: "acceptance_required",
      code: "PROCESSING_AUTHORIZATION_REQUIRED",
      policy: POLICY,
      priorCountry: "pl",
    });
    expect(host.querySelector('[data-testid="acceptance-flow"]')?.textContent).toBe("prior:pl");
    expect(host.textContent).not.toContain("THE LOUNGE");
  });

  it("a cancelled deletion reads the status again, and lets the person back in", async () => {
    io.cancelAccountDeletion.mockResolvedValue({ kind: "cancelled" });
    io.fetchAuthorization.mockResolvedValue({ kind: "authorized", policy: POLICY });
    await mount(blocked());
    const cancel = [...host.querySelectorAll("button")]
      .find((b) => b.textContent?.trim() === LEAVING_COPY.cancel);
    await act(async () => cancel?.click());
    await flush();
    expect(io.cancelAccountDeletion).toHaveBeenCalledWith(PURGE);
    expect(io.fetchAuthorization).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("THE LOUNGE");
  });

  it("a signed-up guest is not asked to accept again: the claim comes before the read", async () => {
    // Founder 2026-10-18. The prefetched read is about the new account alone
    // and says "accept"; the claim moves the guest's acceptance in, and the
    // fresh read after it passes. The acceptance flow is never shown.
    io.hasClaimableGuestOwner.mockReturnValue(true);
    io.claimGuestProjects.mockResolvedValue(true);
    io.fetchAuthorization.mockResolvedValue({ kind: "authorized", policy: POLICY });
    await mount({ kind: "acceptance_required", code: "PROCESSING_AUTHORIZATION_REQUIRED", policy: POLICY });
    expect(io.claimGuestProjects).toHaveBeenCalledTimes(1);
    expect(io.takeAuthorization).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="acceptance-flow"]')).toBeNull();
    expect(host.textContent).toContain("THE LOUNGE");
  });

  it("a refused identity blocks, and Try again reads the status again", async () => {
    io.fetchAuthorization.mockResolvedValue({ kind: "authorized", policy: POLICY });
    await mount({ kind: "identity_failed", message: "The agreement could not be loaded." });
    expect(host.textContent).toContain("The agreement could not be loaded.");
    expect(host.textContent).not.toContain("THE LOUNGE");
    expect(host.querySelector('[data-testid="acceptance-flow"]')).toBeNull();
    const retry = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Try again");
    await act(async () => retry?.click());
    await flush();
    expect(io.fetchAuthorization).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("THE LOUNGE");
    // No active policy is still nothing to accept: it passes, as before.
    expect(gateStateFor({ kind: "unavailable", code: "PROCESSING_POLICY_INACTIVE" }).kind).toBe("pass");
  });
});
