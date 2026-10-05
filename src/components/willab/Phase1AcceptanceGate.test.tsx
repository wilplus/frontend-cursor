// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The gate and a blocked person (audit PLF-T1; founder 2026-10-05, N48.4    */
/*  Q19 A and Q21 A).                                                         */
/*                                                                            */
/*  A processing block used to read as "acceptance required", so a person   */
/*  who had asked for their account to be deleted met the acceptance flow    */
/*  again — and re-accepting could never lift the block. Now:                 */
/*    1. with the ended state switched on, a block shows the ended state and */
/*       never the acceptance flow;                                          */
/*    2. while it is off (its words are not signed), the gate does exactly   */
/*       what it did before;                                                 */
/*    3. a cancelled deletion makes the gate read the status again;          */
/*    4. a re-acceptance hands the flow the country given last time.         */
/* -------------------------------------------------------------------------- */
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

describe("gateStateFor", () => {
  it("a block is the ended state while it is on", () => {
    const status = blocked();
    expect(gateStateFor(status, true)).toEqual({
      kind: "ended",
      pendingDeletion: status.kind === "blocked" ? status.pendingDeletion : null,
    });
    expect(gateStateFor(blocked({ policy: null, pendingDeletion: null }), true))
      .toEqual({ kind: "ended", pendingDeletion: null });
  });

  it("while it is off, a block behaves as before it had a kind of its own", () => {
    expect(gateStateFor(blocked(), false))
      .toEqual({ kind: "required", policy: POLICY, priorCountry: null });
    expect(gateStateFor(blocked({ policy: null }), false)).toEqual({ kind: "pass" });
  });

  it("everything else is unchanged, and a re-acceptance carries its country", () => {
    expect(gateStateFor({ kind: "authorized", policy: POLICY }, true)).toEqual({ kind: "pass" });
    expect(gateStateFor({ kind: "unavailable", code: "X" }, true)).toEqual({ kind: "pass" });
    expect(gateStateFor({ kind: "error", message: "x" }, true)).toEqual({ kind: "pass" });
    expect(gateStateFor({
      kind: "acceptance_required", policy: POLICY, code: "R",
      acceptedEarlierVersion: true, priorCountry: "de",
    }, true)).toEqual({ kind: "required", policy: POLICY, priorCountry: "de" });
    expect(gateStateFor({ kind: "acceptance_required", policy: POLICY, code: "R" }, true))
      .toEqual({ kind: "required", policy: POLICY, priorCountry: null });
  });
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

  it("while the ended state is off, a block still meets the flow as before", async () => {
    flag.ended = false;
    await mount(blocked());
    expect(host.querySelector('[data-testid="account-ended-state"]')).toBeNull();
    expect(host.querySelector('[data-testid="acceptance-flow"]')).not.toBeNull();
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

  it("hands a re-acceptance the country given last time (Q21 A)", async () => {
    await mount({
      kind: "acceptance_required", policy: POLICY, code: "R",
      acceptedEarlierVersion: true, priorCountry: "de",
    });
    expect(host.querySelector('[data-testid="acceptance-flow"]')?.textContent).toBe("prior:de");
  });
});
