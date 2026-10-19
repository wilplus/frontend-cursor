// @vitest-environment jsdom
/*
STORY    As a speaker, I want deleting my account to need a confirm, send one
         request, and let me cancel inside 7 days, so that I never lose my
         account by accident (deletion).
OUTCOME
  O1  Switched off, the card shows nothing and reads nothing.
  O2  Nothing is sent before the confirm; the confirm sends one
      account-deletion request through the terminate relay and says so.
  O3  A refused or failed request keeps the dialog open, says so, and does
      not claim the deletion is under way.
  O4  A deletion already under way is shown on arrival with its day; the
      cancel names the backend's purge id and gives the account back.
  O5  A cancel the backend refuses (409) says it is too late and removes the
      cancel; a cancel that fails says so and keeps it to try again.
  O6  With an active training yes the confirm ends with "a model already
      trained stays"; without one it does not.
PROVES   O1 -> "switched off, shows nothing and reads nothing"
         O2 -> "sends nothing before the confirm, then one account-deletion request"
         O3 -> "a refused request keeps the dialog and says so"
         O4 -> "once on, names the day and cancels the backend's purge id"
         O5 -> "a refused cancel says too late and removes the cancel; a failed one keeps it"
         O6 -> "the training sentence ends the confirm only with an active training yes"
WHY      Founder 2026-10-05 (Q3a; N48.4 Q14 A; W5 A).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("switched off, shows nothing and reads nothing", async () => {
    const loadPending = vi.fn(async () => pendingAccount());
    await mount({ enabled: false, loadPending });
    expect(container.innerHTML).toBe("");
    expect(loadPending).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("a refused request keeps the dialog and says so", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    await mount({ enabled: true });
    click(DELETE_ACCOUNT_COPY.button);
    click(DELETE_ACCOUNT_COPY.confirmLabel);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Couldn't delete. Try again.");
    expect(container.textContent).not.toContain(DELETE_ACCOUNT_COPY.done);
  });

  it("the training sentence ends the confirm only with an active training yes", async () => {
    await mount({ enabled: true, loadTrainingYes: async () => true });
    click(DELETE_ACCOUNT_COPY.button);
    const dialog = () => document.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(dialog()).toContain(LEAVING_COPY.trainingModelStays);
    act(() => root.unmount());
    root = createRoot(container);
    await mount({ enabled: true, loadTrainingYes: noTraining });
    click(DELETE_ACCOUNT_COPY.button);
    expect(dialog()).toContain(DELETE_ACCOUNT_COPY.confirmTitle);
    expect(dialog()).not.toContain(LEAVING_COPY.trainingModelStays);
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

    it("a refused cancel says too late and removes the cancel; a failed one keeps it", async () => {
      fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
      await mount({ cancelEnabled: true, loadPending: async () => pendingAccount() });
      click(LEAVING_COPY.cancel);
      await flush();
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(LEAVING_COPY.cancelFailed);
      expect(find(LEAVING_COPY.cancel)).toBeDefined();

      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ code: "DELETION_NOT_CANCELLABLE" }), { status: 409 }),
      );
      click(LEAVING_COPY.cancel);
      await flush();
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(LEAVING_COPY.cancelTooLate);
      expect(find(LEAVING_COPY.cancel)).toBeUndefined();
      expect(container.textContent).not.toContain(LEAVING_COPY.cancelled);
    });
  });
});
