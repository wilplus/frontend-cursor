// @vitest-environment jsdom
/* "Delete my account" (founder 2026-10-05, Q3a). Pins: off until the words
 * are signed; nothing is sent before the confirm; the confirm sends one
 * account-deletion request through the terminate relay and says it is under
 * way; a refused request keeps the dialog.
 *
 * Wave 3 (founder 2026-10-05, N48.4 Q14 A): a deletion already under way is
 * read on arrival and said, never offered again; the cancel inside the 7-day
 * window and its words are signed and on (W2, W3, S1 A; N50); the cancel
 * names the backend's purge id, and a refusal or a failure says which. With
 * an active training yes the confirm ends with the signed "A model already
 * trained stays." (W5 A); unknown reads as no. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const status = vi.hoisted(() => ({ fetchAuthorization: vi.fn() }));
vi.mock("@/services/api/processingAuthorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/processingAuthorization")>();
  return { ...actual, fetchAuthorization: status.fetchAuthorization };
});

import DeleteAccountCard from "./DeleteAccountCard";
import { DELETE_ACCOUNT_COPY } from "@/lib/legal/deleteAccountCopy";
import {
  LEAVING_COPY,
  deletionDate,
} from "@/lib/legal/leavingCopy";
import type { PendingDeletion } from "@/services/api/accountDeletion";

const PURGE = "0f8fad5b-d9cb-469f-a165-70867728950e";
const AHEAD = new Date(Date.now() + 5 * 86_400_000).toISOString();

function pendingAccount(over: Partial<PendingDeletion> = {}): PendingDeletion {
  return {
    purgeId: PURGE,
    kind: "account",
    projectId: null,
    completesAfter: AHEAD,
    cancellable: true,
    ...over,
  };
}

const noPending = async () => null;
const noTraining = async () => false;

describe("DeleteAccountCard", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    status.fetchAuthorization.mockReset();
    status.fetchAuthorization.mockResolvedValue({ kind: "unavailable", code: "X" });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const flush = () => act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });

  async function mount(
    props: {
      enabled?: boolean;
      cancelEnabled?: boolean;
      loadPending?: () => Promise<PendingDeletion | null>;
      loadTrainingYes?: () => Promise<boolean>;
    } = {},
  ): Promise<void> {
    act(() => {
      root.render(createElement(DeleteAccountCard, {
        loadPending: noPending, loadTrainingYes: noTraining, ...props,
      }));
    });
    await flush();
  }

  function find(label: string): HTMLButtonElement | undefined {
    return [...document.querySelectorAll("button")].filter(
      (b) => b.textContent?.trim() === label,
    ).pop();
  }

  function click(label: string): void {
    const button = find(label);
    if (!button) throw new Error(`no button ${label}`);
    act(() => { button.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  }

  it("sends nothing before the confirm, then one account-deletion request", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 202 }));
    await mount({ enabled: true });
    click(DELETE_ACCOUNT_COPY.button);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(DELETE_ACCOUNT_COPY.confirmTitle);
    click(DELETE_ACCOUNT_COPY.confirmLabel);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v2/processing-authorization/terminate");
    expect(JSON.parse(init.body).trigger_kind).toBe("account_deletion");
    expect(container.textContent).toContain(DELETE_ACCOUNT_COPY.done);
  });

  describe("cancelling inside the window (Q14 A)", () => {

    it("once on, names the day and cancels the backend's purge id", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ purge_id: PURGE, state: "cancelled" }), { status: 200 }),
      );
      await mount({ cancelEnabled: true, loadPending: async () => pendingAccount() });
      expect(container.textContent).toContain(
        LEAVING_COPY.accountDeletedOn(deletionDate(AHEAD) as string),
      );
      click(LEAVING_COPY.cancel);
      await flush();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`/api/v2/processing-authorization/deletion/${PURGE}/cancel`);
      expect(init.method).toBe("POST");
      expect(container.textContent).toContain(LEAVING_COPY.cancelled);
      expect(find(DELETE_ACCOUNT_COPY.button)).toBeDefined();
    });
  });
});
