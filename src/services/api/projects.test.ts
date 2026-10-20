/*
STORY    As a guest who later signs up, I want my projects kept under a guest
         key and moved to my account, with the key forgotten only after the
         move, so that I never lose my work.
OUTCOME
  O1  The guest key the server issues is kept and sent with my later
      requests.
  O2  Signing up moves my projects using both my login and the guest key,
      and the guest key is forgotten after the move succeeds.
PROVES   O1 -> "stores the issued guest credential and reuses it as an owner header"
         O2 -> "clears the guest credential only after an authenticated atomic claim"
*/
import { beforeEach, describe, expect, it, vi } from "vitest";

let authToken: string | null = null;
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: () => Promise.resolve(authToken),
}));

import {
  GUEST_OWNER_HEADER,
  __resetGuestOwnerMemoryForTests,
  claimGuestProjects,
  createProject,
  guestOwnerHeaders,
} from "./projects";

const store = new Map<string, string>();

beforeEach(() => {
  authToken = null;
  store.clear();
  __resetGuestOwnerMemoryForTests();
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
