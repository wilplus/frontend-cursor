/*
STORY    As a speaker opening the app, I want my screens to read my sign-in
         once between them, not once each in a queue, so that the chat is not
         held up waiting its turn; and a sign-in or sign-out is still seen at
         once.
OUTCOME
  O1  Asks made while a read of the session is out share that one read.
  O2  An ask after the read has answered reads again: a session that
      changed in between (signed out, a new token) is what it gets.
PROVES   O1 -> "asks made while a read is out share it"
         O2 -> "an ask after the answer reads again, so a change is seen"
*/
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

import { readSession } from "./session";
import { getAuthToken } from "@/lib/api/auth-client";

const signedIn = (token: string) => ({ data: { session: { access_token: token } }, error: null });

beforeEach(() => auth.getSession.mockReset());

describe("the shared session read", () => {
  it("asks made while a read is out share it", async () => {
    let answer: (v: unknown) => void = () => {};
    auth.getSession.mockReturnValueOnce(new Promise((r) => (answer = r)));
    const asks = Promise.all([readSession(), getAuthToken(), getAuthToken(), readSession()]);
    answer(signedIn("t1"));
    const [first, token1, token2, last] = await asks;
    expect(auth.getSession).toHaveBeenCalledTimes(1);
    expect([first?.access_token, token1, token2, last?.access_token]).toEqual(["t1", "t1", "t1", "t1"]);
  });

  it("an ask after the answer reads again, so a change is seen", async () => {
    auth.getSession.mockResolvedValueOnce(signedIn("t1"));
    expect(await getAuthToken()).toBe("t1");
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null }); // signed out
    expect(await getAuthToken()).toBeNull();
    auth.getSession.mockResolvedValueOnce(signedIn("t2")); // signed in again, a new token
    expect((await readSession())?.access_token).toBe("t2");
    expect(auth.getSession).toHaveBeenCalledTimes(3);
  });
});
