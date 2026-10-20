// @vitest-environment jsdom
/*
STORY    As a speaker whose account is being deleted, I want one true line, a
         way to Data & consent, and a cancel only when it can still land, so
         that I know where I stand (deletion).
OUTCOME
  O1  One line: the day the deletion completes, or the signed "being
      deleted" words when no day can be said; Data & consent is one tap away;
      never the acceptance flow.
  O2  The cancel shows only when switched on AND the backend says it is
      cancellable.
  O3  A cancel that lands names the purge id and hands back to the gate.
  O4  A refused cancel says it is too late and removes the cancel; a failed
      one says so and keeps it.
PROVES   O1 -> "is one line and the way to Data & consent, never the acceptance flow"
         O1 -> "without a day, says the signed being-deleted words"
         O2 -> "shows the cancel only when switched on and cancellable"
         O3 -> "a cancel that lands hands back to the gate"
         O4 -> "a refused cancel goes away; a failed one stays"
WHY      Founder 2026-10-05 (N48.4 Q19 A, Q14 A; audit PLF-T1).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ cancelAccountDeletion: vi.fn() }));
vi.mock("@/services/api/accountDeletion", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  cancelAccountDeletion: api.cancelAccountDeletion,
}));

import AccountEndedState from "./AccountEndedState";
import { DATA_CONSENT_COPY } from "@/lib/legal/dataConsentCopy";
import { DELETE_ACCOUNT_COPY } from "@/lib/legal/deleteAccountCopy";
import { LEAVING_COPY, deletionDate } from "@/lib/legal/leavingCopy";
import type { PendingDeletion } from "@/services/api/accountDeletion";

const PURGE = "0f8fad5b-d9cb-469f-a165-70867728950e";

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

  it("without a day, says the signed being-deleted words", () => {
    render({ pendingDeletion: account({ completesAfter: null }) });
    expect(host.querySelector('[role="status"]')?.textContent).toBe(DELETE_ACCOUNT_COPY.done);
  });

  it("shows the cancel only when switched on and cancellable", () => {
    render({ cancelEnabled: false });
    expect(button(LEAVING_COPY.cancel)).toBeUndefined();
    render({ cancelEnabled: true, pendingDeletion: account({ cancellable: false }) });
    expect(button(LEAVING_COPY.cancel)).toBeUndefined();
    render({ cancelEnabled: true, pendingDeletion: account() });
    expect(button(LEAVING_COPY.cancel)).toBeDefined();
  });

  it("a refused cancel goes away; a failed one stays", async () => {
    const onCancelled = render({ cancelEnabled: true });
    api.cancelAccountDeletion.mockResolvedValue({ kind: "failed" });
    await act(async () => button(LEAVING_COPY.cancel)?.click());
    await flush();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(LEAVING_COPY.cancelFailed);
    expect(button(LEAVING_COPY.cancel)).toBeDefined();

    api.cancelAccountDeletion.mockResolvedValue({ kind: "refused", code: "DELETION_NOT_CANCELLABLE" });
    await act(async () => button(LEAVING_COPY.cancel)?.click());
    await flush();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(LEAVING_COPY.cancelTooLate);
    expect(button(LEAVING_COPY.cancel)).toBeUndefined();
    expect(onCancelled).not.toHaveBeenCalled();
  });

  it("a cancel that lands hands back to the gate", async () => {
    api.cancelAccountDeletion.mockResolvedValue({ kind: "cancelled" });
    const onCancelled = render({ cancelEnabled: true });
    await act(async () => button(LEAVING_COPY.cancel)?.click());
    await flush();
    expect(api.cancelAccountDeletion).toHaveBeenCalledWith(PURGE);
    expect(onCancelled).toHaveBeenCalledTimes(1);
  });
});
