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
  ensureGuestOwnerToken,
  guestOwnerHeaders,
  markGuestOwnerUsed,
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

describe("a minted guest identity (F1 Repair Plan Phase 0.5)", () => {
  const TOKEN = "principal.minted-secret-that-is-long-enough";
  const mintThen = (rest: (url: string) => unknown) =>
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.endsWith("/principal")
              ? { owner_principal_id: "p", is_guest: true, guest_owner_token: TOKEN }
              : rest(url),
          ),
      }),
    );

  it("an identity only minted is dropped on sign-in, never claimed", async () => {
    // Claiming an empty guest would bind the account's acceptance and every
    // later recording to a principal that never acquired anything.
    vi.stubGlobal("fetch", mintThen(() => ({})));
    await ensureGuestOwnerToken();
    authToken = "access-token";
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await claimGuestProjects()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(guestOwnerHeaders()).toEqual({});
  });

  it("once the guest has accepted, sign-in claims it as before", async () => {
    vi.stubGlobal("fetch", mintThen(() => ({})));
    await ensureGuestOwnerToken();
    await markGuestOwnerUsed();
    authToken = "access-token";
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await claimGuestProjects()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v2/projects/claim",
      expect.objectContaining({
        headers: expect.objectContaining({ [GUEST_OWNER_HEADER]: TOKEN }),
      }),
    );
  });

  it("a project the guest created makes the identity theirs to claim", async () => {
    vi.stubGlobal("fetch", mintThen(() => ({ project_id: "project-1" })));
    await ensureGuestOwnerToken();
    await createProject({ displayName: "Talk", setup: {} });
    authToken = "access-token";
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await claimGuestProjects();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("with storage refused, one identity holds for the whole tab", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("storage unavailable");
      },
      removeItem: () => undefined,
    });
    const fetchMock = mintThen(() => ({ project_id: "project-1" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await ensureGuestOwnerToken()).toBe(TOKEN);
    expect(await ensureGuestOwnerToken()).toBe(TOKEN);
    await createProject({ displayName: "Talk", setup: {} });
    const mints = fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/principal"));
    expect(mints).toHaveLength(1);
    const create = fetchMock.mock.calls.find(([u]) => u === "/api/v2/projects") as unknown as
      [string, RequestInit];
    expect((create[1].headers as Record<string, string>)[GUEST_OWNER_HEADER]).toBe(TOKEN);
  });

  it("a guest used in another tab is claimed, not dropped, from this tab", async () => {
    // Tab A minted; tab B accepted and cleared the shared flag. Tab A's own
    // memory must not overrule the shared storage on sign-in.
    vi.stubGlobal("fetch", mintThen(() => ({})));
    await ensureGuestOwnerToken();
    store.delete("willab_guest_owner_minted_only:v1");
    authToken = "access-token";
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await claimGuestProjects()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v2/projects/claim",
      expect.objectContaining({
        headers: expect.objectContaining({ [GUEST_OWNER_HEADER]: TOKEN }),
      }),
    );
  });

  it("a signed-in person's project never marks a leftover guest identity as used", async () => {
    vi.stubGlobal("fetch", mintThen(() => ({ project_id: "project-1" })));
    await ensureGuestOwnerToken();
    authToken = "access-token";
    await createProject({ displayName: "Talk", setup: {} });
    expect(store.get("willab_guest_owner_minted_only:v1")).toBe("1");
  });

  it("a late mint never overwrites an identity another tab stored meanwhile", async () => {
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      await held;
      return { ok: true, json: async () => (url.endsWith("/principal")
        ? { guest_owner_token: "late-token" } : {}) } as unknown as Response;
    }));
    const pending = ensureGuestOwnerToken();
    store.set("willab_guest_owner:v1", "other-tab-used-token");
    release();
    expect(await pending).toBe("other-tab-used-token");
    expect(store.get("willab_guest_owner:v1")).toBe("other-tab-used-token");
    expect(store.has("willab_guest_owner_minted_only:v1")).toBe(false);
  });
});
