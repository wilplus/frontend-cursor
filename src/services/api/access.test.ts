// @vitest-environment jsdom
/*
STORY    As a member, I want the app to open at once, without waiting each
         time to be told I am a member; as someone on the waitlist, I want to
         be let in the moment I join (backend N471).
OUTCOME
  O1  A member is remembered in this browser and the next open asks no one;
      a waiting account and an unclear answer are never remembered, and
      another account on the same browser is asked.
PROVES   O1 -> "a member is remembered; waiting, an outage and another account are asked"
*/
import { beforeEach, describe, expect, it, vi } from "vitest";

let userId: string | null = "maria";
let reply: { member?: boolean } | null = { member: true };
let ok = true;
const bffFetch = vi.fn(async () => ({ kind: "response", ok, body: reply }));
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch: () => bffFetch() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: userId ? { user: { id: userId } } : null } }) },
  }),
}));

import { getAccess } from "./access";

beforeEach(() => {
  window.localStorage.clear();
  bffFetch.mockClear();
  userId = "maria";
  reply = { member: true };
  ok = true;
});

describe("getAccess", () => {
  it("a member is remembered; waiting, an outage and another account are asked", async () => {
    reply = { member: false };
    expect(await getAccess()).toBe("waiting");
    ok = false;
    expect(await getAccess()).toBe("member");
    expect(bffFetch).toHaveBeenCalledTimes(2);

    ok = true;
    reply = { member: true };
    expect(await getAccess()).toBe("member");
    expect(await getAccess()).toBe("member");
    expect(bffFetch).toHaveBeenCalledTimes(3);

    userId = "tomek";
    reply = { member: false };
    expect(await getAccess()).toBe("waiting");
    expect(bffFetch).toHaveBeenCalledTimes(4);
  });
});
