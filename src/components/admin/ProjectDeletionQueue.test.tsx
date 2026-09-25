// @vitest-environment jsdom
/* Operator queue (P1, N8): Confirm asks first, posts once, shows the purge id. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectDeletionQueue } from "./ProjectDeletionQueue";

const ROW = {
  request_id: "11111111-1111-4111-8111-111111111111",
  project_id: "22222222-2222-4222-8222-222222222222",
  project_name: "Board pitch",
  state: "pending",
  requested_at: "2026-09-26T10:00:00Z",
  due_at: "2026-10-03T10:00:00Z",
  confirmed_at: null,
  acquisition_principal_id: "p1",
};

let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

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
  vi.restoreAllMocks();
});

const flush = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
const confirmButton = () =>
  Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "Confirm deletion"
  );

async function render() {
  act(() => root.render(createElement(ProjectDeletionQueue)));
  await flush();
}

describe("project deletion queue", () => {
  it("lists open requests", async () => {
    fetchMock.mockReturnValueOnce(reply(200, { requests: [ROW] }));
    await render();
    expect(fetchMock).toHaveBeenCalledWith("/api/v2/admin/project-deletions", {
      cache: "no-store",
    });
    expect(container.textContent).toContain("Board pitch");
    expect(confirmButton()).toBeDefined();
  });

  it("sends nothing when the operator backs out", async () => {
    fetchMock.mockReturnValueOnce(reply(200, { requests: [ROW] }));
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await render();
    await act(async () => confirmButton()?.click());
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("confirms once and shows the purge request id", async () => {
    fetchMock
      .mockReturnValueOnce(reply(200, { requests: [ROW] }))
      .mockReturnValueOnce(
        reply(200, { deletion: { state: "confirmed" }, purge_request_id: "purge-9" })
      );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await render();
    await act(async () => confirmButton()?.click());
    await flush();
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/v2/admin/project-deletions/${ROW.request_id}/confirm`,
      { method: "POST", cache: "no-store" }
    );
    expect(container.textContent).toContain("purge purge-9");
    expect(container.textContent).toContain("Confirmed");
    expect(confirmButton()).toBeUndefined();
  });

  it("says so when the confirm is refused", async () => {
    fetchMock
      .mockReturnValueOnce(reply(200, { requests: [ROW] }))
      .mockReturnValueOnce(reply(409, { error: "PROJECT_DELETION_NOT_PENDING" }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await render();
    await act(async () => confirmButton()?.click());
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "PROJECT_DELETION_NOT_PENDING"
    );
    expect(confirmButton()).toBeDefined();
  });
});
