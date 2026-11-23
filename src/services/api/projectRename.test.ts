/*
STORY    As a speaker, I can rename only the project I selected without
         changing the list when the server refuses or I am signed out.
OUTCOME  One authenticated PATCH carries the new name; failure changes nothing.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn() }));

import { getAuthToken } from "@/lib/api/auth-client";
import { renameProject } from "./projectRename";

const token = vi.mocked(getAuthToken);

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(async (..._args: unknown[]) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => token.mockResolvedValue("tok"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("project rename", () => {
  it("renames the selected project through the authenticated BFF", async () => {
    const fn = stubFetch(200, { project_id: "p/1", display_name: "New name" });

    await expect(renameProject("p/1", " New name ")).resolves.toBe("New name");
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v2/projects/p%2F1");
    expect(init).toEqual({
      method: "PATCH",
      credentials: "include",
      headers: { Authorization: "Bearer tok", "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: " New name " }),
    });
  });

  it("changes nothing when refused or signed out", async () => {
    stubFetch(400, { error: { code: "INVALID_INPUT" } });
    await expect(renameProject("p", "")).resolves.toBeNull();

    token.mockResolvedValue(null);
    const fn = stubFetch(200, { display_name: "Ignored" });
    await expect(renameProject("p", "Ignored")).resolves.toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});
