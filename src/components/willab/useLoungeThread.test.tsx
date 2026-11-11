// @vitest-environment jsdom
/*
STORY    As a speaker, I want my chat to stay on screen when the app cannot
         reach the server for a moment, so that a weak signal after my walk
         never blanks my Takes, my Feedback walk or my history.
OUTCOME
  O1  The chat read again with no answer (the network down, a server
      error) keeps every message on screen; read again with an answer, it
      shows the server's thread.
  O2  Opening the app with no answer from the server shows the wait, never
      an empty chat (a new speaker's hello), and my chat once a read again
      answers; the record bar is not held past that first read.
  O3  "Load earlier messages" with no answer keeps the button, so a tap
      asks again; answered, the older messages come in above.
  O4  In a host's chat that takes Takes (backend N648 item 8) the thread is
      that chat's rows alone, read with ?chat=; back in the Lounge, its own
      thread again, with nothing of the other kept.
PROVES   O1 -> "a failed read again keeps the chat on screen, an answered one replaces it"
         O4 -> "N648-8 a host's chat that takes Takes reads its own rows, and the Lounge its own again"
         O2 -> "an open with no answer waits and reads again, never an empty chat"
         O3 -> "an older page with no answer keeps the button"
WHY      The walk's end reads the chat again whatever the summary's answer
         (C9, D4, B8), and on a dropped connection that read fails too. A
         returning speaker opening the iPhone app offline saw the new
         speaker's hello and thought their history was gone.
*/
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLoungeThread, type UseLoungeThreadReturn } from "./useLoungeThread";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (id: string) => ({ client_id: id, role: "bot", kind: "text", body: id, metadata: {}, client_created_at: `2026-11-04T10:00:0${id}Z` });
const page = (...ids: string[]) =>
  new Response(JSON.stringify({ messages: ids.map(row), has_more: false, oldest_cursor: null }), { status: 200, headers: { "Content-Type": "application/json" } });
const olderPage = (more: boolean, ...ids: string[]) =>
  new Response(JSON.stringify({ messages: ids.map(row), has_more: more, oldest_cursor: more ? `c${ids[0]}` : null }), { status: 200, headers: { "Content-Type": "application/json" } });
const offline = async (): Promise<Response> => {
  throw new TypeError("offline");
};

function serve(reads: (() => Promise<Response>)[]) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => (String(input).includes("/lounge/messages") ? reads.shift()!() : new Response("{}", { status: 404 }))));
}

async function mountThread() {
  const box: { thread: UseLoungeThreadReturn | null } = { thread: null };
  function Probe() {
    box.thread = useLoungeThread(true);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  return { box, root, ids: () => box.thread!.messages.map((m) => m.client_id) };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the chat read again (C9, B8)", () => {
  it("a failed read again keeps the chat on screen, an answered one replaces it", async () => {
    // The thread's reads in order: the first load, the network down, a
    // server error, then an answer.
    serve([async () => page("1", "2"), offline, async () => new Response("{}", { status: 503 }), async () => page("3")]);
    const { box, root, ids } = await mountThread();
    expect(ids()).toEqual(["1", "2"]);
    await act(async () => box.thread!.reload());
    expect(ids()).toEqual(["1", "2"]);
    await act(async () => box.thread!.reload());
    expect(ids()).toEqual(["1", "2"]);
    await act(async () => box.thread!.reload());
    expect(ids()).toEqual(["3"]);
    await act(async () => root.unmount());
  });
});

describe("the chat at open, and older messages (O2, O3)", () => {
  it("an open with no answer waits and reads again, never an empty chat", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // The network down at open, a server error two seconds later, then an answer.
    serve([offline, async () => new Response("{}", { status: 503 }), async () => page("1", "2")]);
    const { box, root, ids } = await mountThread();
    expect(box.thread!.loading).toBe(true);
    expect(box.thread!.unanswered).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(box.thread!.loading).toBe(true);
    expect(ids()).toEqual([]);
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(box.thread!.loading).toBe(false);
    expect(box.thread!.unanswered).toBe(false);
    expect(ids()).toEqual(["1", "2"]);
    await act(async () => root.unmount());
  });

  it("an older page with no answer keeps the button", async () => {
    serve([async () => olderPage(true, "5", "6"), offline, async () => olderPage(false, "3", "4")]);
    const { box, root, ids } = await mountThread();
    expect(box.thread!.hasMore).toBe(true);
    await act(async () => box.thread!.loadOlder());
    expect(box.thread!.hasMore).toBe(true);
    expect(ids()).toEqual(["5", "6"]);
    await act(async () => box.thread!.loadOlder());
    expect(box.thread!.hasMore).toBe(false);
    expect(ids()).toEqual(["3", "4", "5", "6"]);
    await act(async () => root.unmount());
  });
});

describe("a host's chat that takes Takes (N648 item 8)", () => {
  it("N648-8 a host's chat that takes Takes reads its own rows, and the Lounge its own again", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      return url.includes("chat=c-artur") ? page("7") : page("1", "2");
    }));
    const box: { thread: UseLoungeThreadReturn | null; open: (chat: string | null) => void } = { thread: null, open: () => undefined };
    function Probe() {
      const [chat, setChat] = useState<string | null>(null);
      box.open = setChat;
      box.thread = useLoungeThread(true, chat);
      return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(createElement(Probe)));
    const ids = () => box.thread!.messages.map((m) => m.client_id);
    expect(ids()).toEqual(["1", "2"]);
    await act(async () => box.open("c-artur"));
    expect(ids()).toEqual(["7"]);
    expect(urls.at(-1)).toContain("/api/v2/user/lounge/messages?");
    expect(urls.at(-1)).toContain("chat=c-artur");
    // A read again in that chat stays that chat's.
    await act(async () => box.thread!.reload());
    expect(urls.at(-1)).toContain("chat=c-artur");
    await act(async () => box.open(null));
    expect(ids()).toEqual(["1", "2"]);
    expect(urls.at(-1)).not.toContain("chat=");
    await act(async () => root.unmount());
  });
});
