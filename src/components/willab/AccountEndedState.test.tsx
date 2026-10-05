// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The ended state (founder 2026-10-05, N48.4 Q19 A and Q14 A; PLF-T1).      */
/*                                                                            */
/*  One line, true of the block in front of it: the day an account deletion  */
/*  completes when it is still ahead, the signed "being deleted" words when  */
/*  no day can be said, and only what is true of every block otherwise.     */
/*  Data & consent stays one tap away. The cancel shows only while its words */
/*  are switched on AND the backend says a cancel can still land; a refusal   */
/*  takes it away, a failure keeps it.                                       */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ cancelAccountDeletion: vi.fn() }));
vi.mock("@/services/api/accountDeletion", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  cancelAccountDeletion: api.cancelAccountDeletion,
}));

import AccountEndedState, { endedLine } from "./AccountEndedState";
import { DELETE_ACCOUNT_COPY } from "@/lib/legal/deleteAccountCopy";
import { DATA_CONSENT_COPY } from "@/lib/legal/dataConsentCopy";
import { LEAVING_COPY, deletionDate } from "@/lib/legal/leavingCopy";
import type { PendingDeletion } from "@/services/api/accountDeletion";

const PURGE = "0f8fad5b-d9cb-469f-a165-70867728950e";
// Local noon, so the day is the same in every time zone a test runs in.
const NOW = new Date(2026, 9, 5, 12, 0, 0);
const DAY_12 = new Date(2026, 9, 12, 12, 0, 0).toISOString();
const DAY_1 = new Date(2026, 9, 1, 12, 0, 0).toISOString();

function account(over: Partial<PendingDeletion> = {}): PendingDeletion {
  return {
    purgeId: PURGE,
    kind: "account",
    projectId: null,
    completesAfter: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    cancellable: true,
    ...over,
  };
}

describe("the one line", () => {
  it("names the day an account deletion completes", () => {
    expect(endedLine(account({ completesAfter: DAY_12 }), NOW))
      .toBe("Your account will be deleted on 12 October.");
  });

  it("says the signed words when no day can be said", () => {
    expect(endedLine(account({ completesAfter: null }), NOW)).toBe(DELETE_ACCOUNT_COPY.done);
    // A day already past would make the sentence untrue.
    expect(endedLine(account({ completesAfter: DAY_1 }), NOW))
      .toBe(DELETE_ACCOUNT_COPY.done);
  });

  it("says only what is true of every block when no account deletion is named", () => {
    expect(endedLine(null, NOW)).toBe(LEAVING_COPY.endedOther);
    expect(endedLine(account({ kind: "project", projectId: "p" }), NOW))
      .toBe(LEAVING_COPY.endedOther);
  });
});

describe("<AccountEndedState>", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    api.cancelAccountDeletion.mockReset();
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const flush = () => act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);

  function render(props: Partial<Parameters<typeof AccountEndedState>[0]> = {}) {
    const onCancelled = vi.fn();
    act(() => {
      root.render(createElement(AccountEndedState, {
        pendingDeletion: account(),
        onCancelled,
        ...props,
      }));
    });
    return onCancelled;
  }

  it("is one line and the way to Data & consent, never the acceptance flow", () => {
    render({ cancelEnabled: false });
    const ahead = deletionDate(account().completesAfter) as string;
    expect(host.querySelector('[role="status"]')?.textContent).toBe(
      LEAVING_COPY.accountDeletedOn(ahead),
    );
    const link = host.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/account/data-consent");
    expect(link?.textContent).toBe(DATA_CONSENT_COPY.title);
    expect(host.textContent).not.toContain("Agree and continue");
  });

  it("offers no cancel while the cancel's words are off", () => {
    render({ cancelEnabled: false });
    expect(button(LEAVING_COPY.cancel)).toBeUndefined();
  });

  it("offers no cancel when the backend says it can no longer land", () => {
    render({ cancelEnabled: true, pendingDeletion: account({ cancellable: false }) });
    expect(button(LEAVING_COPY.cancel)).toBeUndefined();
  });

  it("offers no cancel for a block that is not an account deletion", () => {
    render({ cancelEnabled: true, pendingDeletion: null });
    expect(button(LEAVING_COPY.cancel)).toBeUndefined();
  });

  it("a cancel that lands hands back to the gate", async () => {
    api.cancelAccountDeletion.mockResolvedValue({ kind: "cancelled" });
    const onCancelled = render({ cancelEnabled: true });
    await act(async () => button(LEAVING_COPY.cancel)?.click());
    await flush();
    expect(api.cancelAccountDeletion).toHaveBeenCalledWith(PURGE);
    expect(onCancelled).toHaveBeenCalledTimes(1);
  });

  it("a refused cancel says it is too late and takes the button away", async () => {
    api.cancelAccountDeletion.mockResolvedValue({ kind: "refused", code: "X" });
    const onCancelled = render({ cancelEnabled: true });
    await act(async () => button(LEAVING_COPY.cancel)?.click());
    await flush();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(LEAVING_COPY.cancelTooLate);
    expect(button(LEAVING_COPY.cancel)).toBeUndefined();
    expect(onCancelled).not.toHaveBeenCalled();
  });

  it("a failed cancel says so and keeps the button", async () => {
    api.cancelAccountDeletion.mockResolvedValue({ kind: "failed" });
    const onCancelled = render({ cancelEnabled: true });
    await act(async () => button(LEAVING_COPY.cancel)?.click());
    await flush();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(LEAVING_COPY.cancelFailed);
    expect(button(LEAVING_COPY.cancel)).toBeDefined();
    expect(onCancelled).not.toHaveBeenCalled();
  });
});
