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
import { ACCOUNT_DELETE_ENABLED, DELETE_ACCOUNT_COPY } from "@/lib/legal/deleteAccountCopy";
import {
  ACCOUNT_DELETION_CANCEL_ENABLED,
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

  it("is on now the founder has signed the words, and draws nothing when off", async () => {
    expect(ACCOUNT_DELETE_ENABLED).toBe(true);
    act(() => { root.render(createElement(DeleteAccountCard)); });
    await flush();
    expect(container.querySelector('[data-testid="delete-account-card"]')).not.toBeNull();
    act(() => { root.render(createElement(DeleteAccountCard, { enabled: false })); });
    expect(container.querySelector('[data-testid="delete-account-card"]')).toBeNull();
  });

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

  it("a refused request keeps the dialog", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    await mount({ enabled: true });
    click(DELETE_ACCOUNT_COPY.button);
    click(DELETE_ACCOUNT_COPY.confirmLabel);
    await flush();
    expect(container.textContent).not.toContain(DELETE_ACCOUNT_COPY.done);
    expect(document.body.textContent).toContain(DELETE_ACCOUNT_COPY.confirmTitle);
  });

  describe("a deletion already under way", () => {
    it("is read from the status on arrival and names its day", async () => {
      status.fetchAuthorization.mockResolvedValue({
        kind: "blocked",
        code: "PROCESSING_SERVICE_BLOCKED",
        policy: null,
        pendingDeletion: pendingAccount(),
      });
      act(() => {
        root.render(createElement(DeleteAccountCard, { loadTrainingYes: noTraining }));
      });
      await flush();
      expect(status.fetchAuthorization).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain(
        LEAVING_COPY.accountDeletedOn(deletionDate(AHEAD) as string),
      );
      // Never offered again: a second request would be a second deletion.
      expect(find(DELETE_ACCOUNT_COPY.button)).toBeUndefined();
    });

    it("says the signed words once its day has passed", async () => {
      const past = new Date(Date.now() - 86_400_000).toISOString();
      await mount({ loadPending: async () => pendingAccount({ completesAfter: past }) });
      expect(container.textContent).toContain(DELETE_ACCOUNT_COPY.done);
      expect(find(DELETE_ACCOUNT_COPY.button)).toBeUndefined();
    });

    it("a project's deletion, or no block, leaves the card as it was", async () => {
      for (const answer of [
        { kind: "authorized", policy: {} },
        {
          kind: "blocked", code: "PROCESSING_SERVICE_BLOCKED", policy: null,
          pendingDeletion: pendingAccount({ kind: "project", projectId: "p" }),
        },
        { kind: "blocked", code: "PROCESSING_SERVICE_BLOCKED", policy: null, pendingDeletion: null },
      ]) {
        status.fetchAuthorization.mockResolvedValue(answer);
        act(() => {
          root.render(createElement(DeleteAccountCard, {
            key: JSON.stringify(answer), loadTrainingYes: noTraining,
          }));
        });
        await flush();
        expect(find(DELETE_ACCOUNT_COPY.button)).toBeDefined();
        expect(container.textContent).not.toContain(DELETE_ACCOUNT_COPY.done);
      }
    });
  });

  describe("cancelling inside the window (Q14 A)", () => {
    it("is on now the founder has signed its words (S1 A)", () => {
      expect(ACCOUNT_DELETION_CANCEL_ENABLED).toBe(true);
    });

    it("switched off, keeps the signed words and offers no cancel", async () => {
      await mount({ cancelEnabled: false, loadPending: async () => pendingAccount() });
      expect(container.textContent).toContain(DELETE_ACCOUNT_COPY.done);
      expect(container.textContent).not.toContain(deletionDate(AHEAD) ?? "never");
      expect(find(LEAVING_COPY.cancel)).toBeUndefined();
    });

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

    it("a refusal says it is too late and takes the button away", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ code: "DELETION_NOT_CANCELLABLE" }), { status: 409 }),
      );
      await mount({ cancelEnabled: true, loadPending: async () => pendingAccount() });
      click(LEAVING_COPY.cancel);
      await flush();
      expect(container.textContent).toContain(LEAVING_COPY.cancelTooLate);
      expect(find(LEAVING_COPY.cancel)).toBeUndefined();
      expect(find(DELETE_ACCOUNT_COPY.button)).toBeUndefined();
    });

    it("a failure says so and keeps the button to try again", async () => {
      fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
      await mount({ cancelEnabled: true, loadPending: async () => pendingAccount() });
      click(LEAVING_COPY.cancel);
      await flush();
      expect(container.textContent).toContain(LEAVING_COPY.cancelFailed);
      expect(find(LEAVING_COPY.cancel)).toBeDefined();
    });

    it("offers no cancel when the backend says it can no longer land", async () => {
      await mount({
        cancelEnabled: true,
        loadPending: async () => pendingAccount({ cancellable: false }),
      });
      expect(find(LEAVING_COPY.cancel)).toBeUndefined();
    });

    it("once on, the confirm states the window and the receipt offers the cancel", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({
        purge_id: PURGE, state: "requested", completes_after: AHEAD, cancellable: true,
      }), { status: 202 }));
      await mount({ cancelEnabled: true });
      click(DELETE_ACCOUNT_COPY.button);
      expect(document.body.textContent).toContain(LEAVING_COPY.accountConfirmBody);
      expect(document.body.textContent).not.toContain(DELETE_ACCOUNT_COPY.confirmBody);
      click(DELETE_ACCOUNT_COPY.confirmLabel);
      await flush();
      expect(container.textContent).toContain(
        LEAVING_COPY.accountDeletedOn(deletionDate(AHEAD) as string),
      );
      expect(find(LEAVING_COPY.cancel)).toBeDefined();
    });
  });

  describe("the training line (W5 A)", () => {
    function confirmText(): string {
      return document.querySelector('[role="dialog"]')?.textContent ?? "";
    }

    it("ends the confirm with the signed line for an active training yes", async () => {
      await mount({ loadTrainingYes: async () => true });
      click(DELETE_ACCOUNT_COPY.button);
      expect(confirmText()).toContain(
        `${LEAVING_COPY.accountConfirmBody} ${LEAVING_COPY.trainingModelStays}`,
      );
    });

    it("adds it to the signed body as well while cancelling is off", async () => {
      await mount({ cancelEnabled: false, loadTrainingYes: async () => true });
      click(DELETE_ACCOUNT_COPY.button);
      expect(confirmText()).toContain(
        `${DELETE_ACCOUNT_COPY.confirmBody} ${LEAVING_COPY.trainingModelStays}`,
      );
    });

    it("is not there with training off or unreadable", async () => {
      for (const load of [async () => false, async () => { throw new Error("x"); }]) {
        await mount({ loadTrainingYes: load });
        click(DELETE_ACCOUNT_COPY.button);
        expect(confirmText()).toContain(LEAVING_COPY.accountConfirmBody);
        expect(confirmText()).not.toContain(LEAVING_COPY.trainingModelStays);
        click("Cancel");
        act(() => root.unmount());
        root = createRoot(container);
      }
    });
  });
});
