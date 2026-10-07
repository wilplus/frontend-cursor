// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const status = vi.hoisted(() => ({ fetchAuthorization: vi.fn() }));
vi.mock("@/services/api/processingAuthorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/processingAuthorization")>();
  return { ...actual, fetchAuthorization: status.fetchAuthorization };
});

import DeleteAccountCard, { SBTN_HOVER, SBTN_RED_HOVER } from "./DeleteAccountCard";
import { DELETE_ACCOUNT_COPY } from "@/lib/legal/deleteAccountCopy";
import { LEAVING_COPY } from "@/lib/legal/leavingCopy";
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

describe("DeleteAccountCard outline hover", () => {
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

  function classes(button: HTMLButtonElement): string[] {
    return button.className.split(/\s+/);
  }

  it("exports the signed hover classes", () => {
    expect(SBTN_HOVER).toBe("hover:bg-muted hover:text-foreground");
    expect(SBTN_RED_HOVER).toBe("hover:bg-muted hover:text-destructive");
  });

  it("Delete my account hovers grey and stays red", async () => {
    await mount();
    const button = find(DELETE_ACCOUNT_COPY.button);
    if (!button) throw new Error(`no button ${DELETE_ACCOUNT_COPY.button}`);
    const names = classes(button);
    expect(names).toContain("text-destructive");
    expect(names).toContain("hover:bg-muted");
    expect(names).toContain("hover:text-destructive");
    expect(names).not.toContain("hover:bg-accent");
    expect(names).not.toContain("hover:text-accent-foreground");
    expect(names).toContain("h-10");
  });

  it("Cancel deletion hovers grey and keeps its text colour", async () => {
    await mount({ cancelEnabled: true, loadPending: async () => pendingAccount() });
    const button = find(LEAVING_COPY.cancel);
    if (!button) throw new Error(`no button ${LEAVING_COPY.cancel}`);
    const names = classes(button);
    expect(names).toContain("hover:bg-muted");
    expect(names).toContain("hover:text-foreground");
    expect(names).not.toContain("hover:bg-accent");
    expect(names).not.toContain("hover:text-accent-foreground");
    expect(names).toContain("h-10");
    expect(names).toContain("mt-3");
  });
});
