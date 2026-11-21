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
  O5  A failed optimistic write keeps one exact bubble; retry reuses its
      client id, and the authoritative reload replaces rather than duplicates it.
  O6  A short user turn stays beside a structured response while the server
      read is eventually consistent, then reconciles to one row.
  O7  Intentionally repeated identical sends remain two turns; an older equal
      quick answer cannot consume the optimistic new one during reconciliation.
PROVES   O1 -> "a failed read again keeps the chat on screen, an answered one replaces it"
         O4 -> "N648-8 a host's chat that takes Takes reads its own rows, and the Lounge its own again"
         O2 -> "an open with no answer waits and reads again, never an empty chat"
         O3 -> "an older page with no answer keeps the button"
         O5 -> "N655 keeps a failed optimistic row retryable and reconciles the same client id once"
         O6 -> "N655 keeps a short user turn beside a structured response until reconciliation"
         O7 -> "keeps intentionally repeated identical sends as separate idempotent rows"
         O7 -> "does not reconcile a repeated quick answer against an older identical row"
WHY      The walk's end reads the chat again whatever the summary's answer
         (C9, D4, B8), and on a dropped connection that read fails too. A
         returning speaker opening the iPhone app offline saw the new
         speaker's hello and thought their history was gone.
*/
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useLoungeThread,
  type RecoverableAppend,
  type UseLoungeThreadReturn,
} from "./useLoungeThread";
import type { LoungeMessage } from "@/services/api/loungeMessages";

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

  it("N655 keeps a failed optimistic row retryable and reconciles the same client id once", async () => {
    let writes = 0;
    let stored: ReturnType<typeof row>[] = [];
    let refuseFirst!: (reason?: unknown) => void;
    const firstWrite = new Promise<Response>((_resolve, reject) => {
      refuseFirst = reject;
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).includes("/lounge/messages")) return new Response("{}", { status: 404 });
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as { messages: ReturnType<typeof row>[] };
        writes += 1;
        if (writes === 1) return firstWrite;
        stored = payload.messages;
        return new Response(JSON.stringify({ messages: stored }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ messages: stored, has_more: false, oldest_cursor: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));
    const { box, root, ids } = await mountThread();
    let pending!: RecoverableAppend;
    act(() => {
      pending = box.thread!.appendRecoverable({ role: "user", kind: "text", body: "Keep these words" });
    });
    const clientId = pending.message.client_id;
    expect(ids()).toEqual([clientId]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let firstStored = true;
    await act(async () => {
      refuseFirst(new TypeError("offline"));
      firstStored = await pending.stored;
    });
    expect(firstStored).toBe(false);
    expect(ids()).toEqual([clientId]);

    let retried = false;
    await act(async () => {
      retried = await pending.retry();
    });
    expect(retried).toBe(true);
    expect(stored[0]?.client_id).toBe(clientId);
    await act(async () => box.thread!.reload());
    expect(ids()).toEqual([clientId]);
    warn.mockRestore();
    await act(async () => root.unmount());
  });

  it("N655 keeps a short user turn beside a structured response until reconciliation", async () => {
    const structured: LoungeMessage = {
      client_id: "pattern-card",
      client_created_at: "2026-11-16T10:00:01.000Z",
      role: "bot",
      kind: "insight",
      body: "We spotted a pattern.",
      metadata: { pattern_card: true },
    };
    let serverRows: LoungeMessage[] = [structured];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).includes("/lounge/messages")) return new Response("{}", { status: 404 });
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as { messages: LoungeMessage[] };
        return new Response(JSON.stringify({ messages: payload.messages }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ messages: serverRows, has_more: false, oldest_cursor: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));
    const { box, root, ids } = await mountThread();
    let pending!: RecoverableAppend;
    await act(async () => {
      pending = box.thread!.appendRecoverable({ role: "user", kind: "text", body: "hi" });
      await Promise.resolve();
    });
    const clientId = pending.message.client_id;
    expect(ids()).toEqual(["pattern-card", clientId]);

    await act(async () => {
      expect(await pending.stored).toBe(true);
      await box.thread!.reload();
    });
    expect(ids()).toEqual(["pattern-card", clientId]);

    serverRows = [structured, pending.message];
    await act(async () => box.thread!.reload());
    expect(ids()).toEqual(["pattern-card", clientId]);
    expect(ids().filter((id) => id === clientId)).toHaveLength(1);
    await act(async () => root.unmount());
  });

  it("keeps intentionally repeated identical sends as separate idempotent rows", async () => {
    let stored: LoungeMessage[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).includes("/lounge/messages")) return new Response("{}", { status: 404 });
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as { messages: LoungeMessage[] };
        stored = [...stored, ...payload.messages];
        return new Response(JSON.stringify({ messages: payload.messages }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ messages: stored, has_more: false, oldest_cursor: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));
    const { box, root } = await mountThread();
    let first!: RecoverableAppend;
    let second!: RecoverableAppend;
    await act(async () => {
      first = box.thread!.appendRecoverable({ role: "user", kind: "text", body: "Again" });
      await first.stored;
      second = box.thread!.appendRecoverable({ role: "user", kind: "text", body: "Again" });
      await second.stored;
    });
    expect(first.message.client_id).not.toBe(second.message.client_id);
    await act(async () => box.thread!.reload());
    expect(box.thread!.messages.filter((message) => message.body === "Again")).toHaveLength(2);
    await act(async () => root.unmount());
  });

  it("does not reconcile a repeated quick answer against an older identical row", async () => {
    const older: LoungeMessage = {
      client_id: "older-no",
      client_created_at: "2026-11-17T09:00:00.000Z",
      role: "user",
      kind: "text",
      body: "No",
      metadata: null,
    };
    let serverRows = [older];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (!String(input).includes("/lounge/messages")) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify({ messages: serverRows, has_more: false, oldest_cursor: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));
    const { box, root } = await mountThread();
    let optimistic!: ReturnType<UseLoungeThreadReturn["own"]>;
    act(() => {
      optimistic = box.thread!.own("No");
      optimistic.settle();
    });
    await act(async () => box.thread!.reload());
    expect(box.thread!.messages.filter((message) => message.body === "No")).toHaveLength(2);

    const optimisticRow = box.thread!.messages.find((message) => message.client_id !== older.client_id)!;
    serverRows = [
      older,
      {
        ...optimisticRow,
        client_id: "new-no",
        client_created_at: "2026-11-17T10:00:00.000Z",
      },
    ];
    await act(async () => box.thread!.reload());
    expect(box.thread!.messages.filter((message) => message.body === "No")).toHaveLength(2);
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
