// @vitest-environment jsdom
/* "Delete my account" (founder 2026-10-05, Q3a). Pins: off until the words
 * are signed; nothing is sent before the confirm; the confirm sends one
 * account-deletion request through the terminate relay and says it is under
 * way; a refused request keeps the dialog. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeleteAccountCard from "./DeleteAccountCard";
import { ACCOUNT_DELETE_ENABLED, DELETE_ACCOUNT_COPY } from "@/lib/legal/deleteAccountCopy";

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

  function mount(enabled: boolean): void {
    act(() => { root.render(createElement(DeleteAccountCard, { enabled })); });
  }

  function click(label: string): void {
    const button = [...document.querySelectorAll("button")].filter(
      (b) => b.textContent?.trim() === label,
    ).pop();
    if (!button) throw new Error(`no button ${label}`);
    act(() => { button.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  }

  it("is on now the founder has signed the words, and draws nothing when off", () => {
    expect(ACCOUNT_DELETE_ENABLED).toBe(true);
    act(() => { root.render(createElement(DeleteAccountCard)); });
    expect(container.querySelector('[data-testid="delete-account-card"]')).not.toBeNull();
    act(() => { root.render(createElement(DeleteAccountCard, { enabled: false })); });
    expect(container.querySelector('[data-testid="delete-account-card"]')).toBeNull();
  });

  it("sends nothing before the confirm, then one account-deletion request", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 202 }));
    mount(true);
    click(DELETE_ACCOUNT_COPY.button);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(DELETE_ACCOUNT_COPY.confirmTitle);
    click(DELETE_ACCOUNT_COPY.confirmLabel);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v2/processing-authorization/terminate");
    expect(JSON.parse(init.body).trigger_kind).toBe("account_deletion");
    expect(container.textContent).toContain(DELETE_ACCOUNT_COPY.done);
  });

  it("a refused request keeps the dialog", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    mount(true);
    click(DELETE_ACCOUNT_COPY.button);
    click(DELETE_ACCOUNT_COPY.confirmLabel);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).not.toContain(DELETE_ACCOUNT_COPY.done);
    expect(document.body.textContent).toContain(DELETE_ACCOUNT_COPY.confirmTitle);
  });
});
