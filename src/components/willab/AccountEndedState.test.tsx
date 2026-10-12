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

import AccountEndedState, {  } from "./AccountEndedState";
import { DATA_CONSENT_COPY } from "@/lib/legal/dataConsentCopy";
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

  it("a cancel that lands hands back to the gate", async () => {
    api.cancelAccountDeletion.mockResolvedValue({ kind: "cancelled" });
    const onCancelled = render({ cancelEnabled: true });
    await act(async () => button(LEAVING_COPY.cancel)?.click());
    await flush();
    expect(api.cancelAccountDeletion).toHaveBeenCalledWith(PURGE);
    expect(onCancelled).toHaveBeenCalledTimes(1);
  });
});
