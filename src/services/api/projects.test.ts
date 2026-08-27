import { beforeEach, describe, expect, it, vi } from "vitest";

let authToken: string | null = null;
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: () => Promise.resolve(authToken),
}));

import {
  GUEST_OWNER_HEADER,
  claimGuestProjects,
  createProject,
  guestOwnerHeaders,
} from "./projects";

const store = new Map<string, string>();

beforeEach(() => {
  authToken = null;
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});

describe("canonical project ownership client", () => {
  it("stores the issued guest credential and reuses it as an owner header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              project_id: "project-1",
              guest_owner_token:
                "principal.secret-value-that-is-long-enough",
            }),
        }),
      ),
    );
    expect(await createProject({ displayName: "Talk", setup: {} })).toEqual({
      kind: "ok",
      projectId: "project-1",
      guestOwnerToken: "principal.secret-value-that-is-long-enough",
    });
    expect(guestOwnerHeaders()).toEqual({
      [GUEST_OWNER_HEADER]: "principal.secret-value-that-is-long-enough",
    });
  });

  it("returns the issued credential for the immediate upload when storage is unavailable", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("storage unavailable");
      },
      removeItem: () => undefined,
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        project_id: "project-1",
        guest_owner_token: "principal.secret-value-that-is-long-enough",
      }),
    })));

    await expect(
      createProject({ displayName: "Talk", setup: {} }),
    ).resolves.toEqual({
      kind: "ok",
      projectId: "project-1",
      guestOwnerToken: "principal.secret-value-that-is-long-enough",
    });
  });

  it("clears the guest credential only after an authenticated atomic claim", async () => {
    store.set(
      "willab_guest_owner:v1",
      "principal.secret-value-that-is-long-enough"
    );
    authToken = "access-token";
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await claimGuestProjects()).toBe(true);
    expect(guestOwnerHeaders()).toEqual({});
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v2/projects/claim",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          [GUEST_OWNER_HEADER]:
            "principal.secret-value-that-is-long-enough",
        }),
      })
    );
  });
});
