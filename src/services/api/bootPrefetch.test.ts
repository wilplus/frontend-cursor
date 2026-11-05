// @vitest-environment jsdom
/*
STORY    As a returning member opening the app, I want my chat to start
         loading while the app checks that I am a member, not after it, so
         that my thread is there a whole round trip sooner; and as someone on
         the waitlist, I want that early start to change nothing of mine.
OUTCOME
  O1  For an account this device has seen let in, /chat's open starts the
      members check, the thread, the agreement and the session state
      together, and each is read once: the screens take those reads.
  O2  For any other signed-in account only the members check and the
      thread (a read that writes nothing) start early; signed out, nothing
      starts and no guest identity is made.
  O3  The members check is one request at a time; a member is kept for the
      page, a waitlist answer is asked again.
PROVES   O1 -> "a returning member's chat starts its reads with the members check, each read once"
         O2 -> "an account not let in here starts only its thread; signed out starts nothing"
         O3 -> "the members check is asked once at a time; a member is kept, the waitlist asked again"
WHY      Loading time (2026-11-05): the members check (backend N471) put a
         whole round trip in front of every boot read.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  session: null as null | { access_token: string; user: { id: string } },
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession: async () => ({ data: { session: auth.session } }) } }),
}));

import { __resetAccessForTests, getAccess } from "./access";
import {
  __resetBootPrefetchForTests,
  prefetchChatBoot,
  prefetchChatOpen,
  takeAuthorization,
  takeLoungeHistory,
  takeSessionState,
} from "./bootPrefetch";

const ACCESS = "GET /api/v2/me/access";
const THREAD = "GET /api/v2/user/lounge/messages";
const AGREEMENT = "GET /api/v2/processing-authorization";
const SESSION_STATE = "GET /api/v2/chat/session-state";
const GUEST_MINT = "POST /api/v2/processing-authorization/principal";

const fetchMock = vi.fn();
let member = true;
/** The members check answers only when released, so a test can look at
 *  what started before it answered. */
let releaseAccess: () => void = () => {};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

function keyOf(url: unknown, init?: RequestInit): string {
  return `${init?.method ?? "GET"} ${String(url).split("?")[0]}`;
}
const requests = () => fetchMock.mock.calls.map(([url, init]) => keyOf(url, init));
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function signIn(id: string | null) {
  auth.session = id ? { access_token: `token-${id}`, user: { id } } : null;
}

/** A new page: nothing in memory, the device's storage kept. */
function newPage() {
  __resetAccessForTests();
  __resetBootPrefetchForTests();
  fetchMock.mockClear();
}

beforeEach(() => {
  window.localStorage.clear();
  newPage();
  member = true;
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const key = keyOf(url, init);
    if (key === ACCESS) {
      return new Promise<Response>((resolve) => {
        releaseAccess = () => resolve(json({ member, invite_only: true }));
      });
    }
    if (key === THREAD) return Promise.resolve(json({ messages: [], has_more: false, oldest_cursor: null }));
    if (key === SESSION_STATE) return Promise.resolve(json({ state: "PENDING_COACH" }));
    if (key === AGREEMENT) return Promise.resolve(json({ policy_available: false, code: "PROCESSING_POLICY_INACTIVE" }));
    return Promise.resolve(json({}));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Let the server let `id` in once on this device, then start a new page. */
async function letInBefore(id: string) {
  signIn(id);
  const answer = getAccess();
  await settle();
  releaseAccess();
  expect(await answer).toBe("member");
  newPage();
}

describe("/chat's open: the boot reads start with the members check", () => {
  it("a returning member's chat starts its reads with the members check, each read once", async () => {
    await letInBefore("maria");

    await prefetchChatOpen({ parked: false });
    await settle();
    // The members check has not answered, and everything the thread waits
    // for is already on its way.
    expect(requests().sort()).toEqual([ACCESS, AGREEMENT, SESSION_STATE, THREAD].sort());

    // MembersOnly asks and shares the request; then the screens take theirs.
    const asked = getAccess();
    await settle();
    releaseAccess();
    expect(await asked).toBe("member");
    prefetchChatBoot(); // useWillabFlow, once the member is in
    expect(await takeSessionState()).toBe("PENDING_COACH");
    expect((await takeAuthorization()).kind).toBe("unavailable");
    expect((await takeLoungeHistory()).messages).toEqual([]);
    expect(requests().sort()).toEqual([ACCESS, AGREEMENT, SESSION_STATE, THREAD].sort());
    expect(requests()).not.toContain(GUEST_MINT);
  });

  it("an account not let in here starts only its thread; signed out starts nothing", async () => {
    signIn("noa");
    await prefetchChatOpen({ parked: false });
    await settle();
    expect(requests().sort()).toEqual([ACCESS, THREAD].sort());

    // On the waitlist: nothing else was asked, and nothing is kept.
    member = false;
    releaseAccess();
    expect(await getAccess()).toBe("waiting");
    newPage();
    await prefetchChatOpen({ parked: false });
    await settle();
    expect(requests().sort()).toEqual([ACCESS, THREAD].sort());

    // Signed out: not one request, so no guest identity either.
    signIn(null);
    newPage();
    await prefetchChatOpen({ parked: false });
    await settle();
    expect(requests()).toEqual([]);
  });

  it("the members check is asked once at a time; a member is kept, the waitlist asked again", async () => {
    signIn("maria");
    const first = getAccess();
    const second = getAccess();
    await settle();
    releaseAccess();
    expect([await first, await second]).toEqual(["member", "member"]);
    expect(await getAccess()).toBe("member");
    expect(requests()).toEqual([ACCESS]);

    signIn("noa");
    member = false;
    const waiting = getAccess();
    await settle();
    releaseAccess();
    expect(await waiting).toBe("waiting");
    const again = getAccess();
    await settle();
    releaseAccess();
    expect(await again).toBe("waiting");
    expect(requests()).toEqual([ACCESS, ACCESS, ACCESS]);
  });
});
