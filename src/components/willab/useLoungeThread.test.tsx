// @vitest-environment jsdom
/*
STORY    As a speaker, I want my chat to stay on screen when the app cannot
         reach the server for a moment, so that a weak signal after my walk
         never blanks my Takes, my Feedback walk or my history.
OUTCOME
  O1  The chat read again with no answer (the network down, a server
      error) keeps every message on screen; read again with an answer, it
      shows the server's thread.
PROVES   O1 -> "a failed read again keeps the chat on screen, an answered one replaces it"
WHY      The walk's end reads the chat again whatever the summary's answer
         (C9, D4, B8), and on a dropped connection that read fails too.
*/
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLoungeThread, type UseLoungeThreadReturn } from "./useLoungeThread";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (id: string) => ({ client_id: id, role: "bot", kind: "text", body: id, metadata: {}, client_created_at: `2026-11-04T10:00:0${id}Z` });
const page = (...ids: string[]) =>
  new Response(JSON.stringify({ messages: ids.map(row), has_more: false, oldest_cursor: null }), { status: 200, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("the chat read again (C9, B8)", () => {
  it("a failed read again keeps the chat on screen, an answered one replaces it", async () => {
    const box: { thread: UseLoungeThreadReturn | null } = { thread: null };
    function Probe() {
      box.thread = useLoungeThread(true);
      return null;
    }
    // The thread's reads in order: the first load, the network down, a
    // server error, then an answer.
    const reads: (() => Promise<Response>)[] = [
      async () => page("1", "2"),
      async () => {
        throw new TypeError("offline");
      },
      async () => new Response("{}", { status: 503 }),
      async () => page("3"),
    ];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => (String(input).includes("/lounge/messages") ? reads.shift()!() : new Response("{}", { status: 404 }))));
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(createElement(Probe)));
    const ids = () => box.thread!.messages.map((m) => m.client_id);
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
