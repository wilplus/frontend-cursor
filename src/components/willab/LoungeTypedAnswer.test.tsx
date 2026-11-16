// @vitest-environment jsdom
/*
STORY    As a speaker answering Will in the main speaking chat, I see my own
         words immediately and never lose them to a slow or failed model call.
OUTCOME  The open project question keeps its composer, uses contextual chat,
         preserves project/place identity, and reconciles one own bubble.
WHY      Founder lock N655, 2026-11-16.
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";

const harness = vi.hoisted(() => ({
  rows: [] as LoungeMessage[],
  appended: [] as LoungeMessage[],
  visible: [] as LoungeMessage[],
  reloadGate: null as Promise<void> | null,
  reads: 0,
  query: vi.fn(),
  willQuestion: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/chat",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "token") }));
vi.mock("./useUserId", () => ({ useUserId: () => "user-a" }));
vi.mock("./useSignedIn", () => ({ useSignedIn: () => true }));
vi.mock("@/services/api/chatQuery", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  postChatQuery: (...args: unknown[]) => harness.query(...args),
}));
vi.mock("@/services/api/willQuestion", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  postWillQuestion: (...args: unknown[]) => harness.willQuestion(...args),
}));

import Lounge from "./Lounge";
import { LoungeThreadProvider, useLoungeThreadCtx } from "./LoungeThreadContext";
import { setOpenPlace } from "./chats/loungePlace";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const QUESTION: LoungeMessage = {
  client_id: "question-a",
  client_created_at: "2026-11-16T10:00:00.000Z",
  role: "bot",
  kind: "text",
  body: "Who needs to act on this?",
  metadata: {
    arc_id: "arc-a",
    take_session_id: "take-a",
    offer: "will_question",
    will_question_step: "ask",
    chips: ["Leadership", "My team"],
    place: "speaking",
  },
};

let host: HTMLDivElement;
let root: Root;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const flush = () => act(async () => {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
});

async function waitForComposer(): Promise<HTMLTextAreaElement> {
  for (let index = 0; index < 40; index += 1) {
    const field = host.querySelector('textarea[aria-label="Message Will"]') as HTMLTextAreaElement | null;
    if (field) return field;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  }
  throw new Error("Main Will composer did not open");
}

function enter(field: HTMLTextAreaElement, value: string): void {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function send(field: HTMLTextAreaElement): void {
  act(() => {
    field.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

function ownWords(body: string): Element[] {
  return [...host.querySelectorAll("[data-row='me']")].filter((node) => node.textContent === body);
}

function ThreadProbe(): null {
  harness.visible = useLoungeThreadCtx().messages;
  return null;
}

beforeEach(() => {
  harness.rows = [QUESTION];
  harness.appended = [];
  harness.visible = [];
  harness.reloadGate = null;
  harness.reads = 0;
  harness.query.mockReset();
  harness.willQuestion.mockReset().mockResolvedValue(true);
  localStorage.clear();
  setOpenPlace("speaking");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/v2/user/lounge/messages")) {
      if ((init?.method ?? "GET") === "POST") {
        const payload = JSON.parse(String(init?.body ?? "{}")) as { messages?: LoungeMessage[] };
        const messages = payload.messages ?? [];
        harness.appended.push(...messages);
        return new Response(JSON.stringify({ messages }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      harness.reads += 1;
      if (harness.reloadGate) await harness.reloadGate;
      return new Response(JSON.stringify({
        messages: harness.rows,
        has_more: false,
        oldest_cursor: null,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("{}", { status: 404, headers: { "content-type": "application/json" } });
  }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  setOpenPlace(null);
  vi.unstubAllGlobals();
});

async function renderLounge(): Promise<HTMLTextAreaElement> {
  await act(async () => root.render(
    <LoungeThreadProvider signedIn>
      <ThreadProbe />
      <Lounge state={"lounge_idle" as never} onStart={() => undefined} dispatch={() => undefined} />
    </LoungeThreadProvider>,
  ));
  return waitForComposer();
}

describe("typed answer in the main Will/Lounge chat", () => {
  it("renders a tapped option immediately and reconciles it with the backend row once", async () => {
    const request = deferred<boolean>();
    harness.willQuestion.mockImplementation(async () => {
      const accepted = await request.promise;
      if (accepted) {
        harness.rows = [
          QUESTION,
          {
            client_id: "answer-a",
            client_created_at: "2026-11-16T10:00:01.000Z",
            role: "user",
            kind: "text",
            body: "Leadership",
            metadata: {
              arc_id: "arc-a",
              take_session_id: "take-a",
              will_question_step: "answer",
              place: "speaking",
            },
          },
          {
            client_id: "reply-a",
            client_created_at: "2026-11-16T10:00:02.000Z",
            role: "bot",
            kind: "text",
            body: "That helps me understand the context.",
            metadata: {
              arc_id: "arc-a",
              take_session_id: "take-a",
              will_question_step: "reply",
              place: "speaking",
            },
          },
        ];
      }
      return accepted;
    });
    await renderLounge();
    const leadership = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Leadership",
    )!;
    act(() => leadership.click());
    await flush();

    expect(ownWords("Leadership")).toHaveLength(1);
    expect(host.querySelector('textarea[aria-label="Message Will"]')).not.toBeNull();
    expect(harness.willQuestion).toHaveBeenCalledWith("arc-a", "take-a", "Leadership");

    await act(async () => request.resolve(true));
    await flush();
    expect(ownWords("Leadership")).toHaveLength(1);
    expect(host.textContent).toContain("That helps me understand the context.");
  });

  it("uses backend-owned persistence, keeps authoritative metadata locally, and reconciles once", async () => {
    const request = deferred<{
      answer: string;
      persisted: boolean;
      after_take: boolean;
      row_metadata: Record<string, unknown>;
    }>();
    const reload = deferred<void>();
    harness.query.mockReturnValue(request.promise);
    const field = await renderLounge();
    const readsBeforeTurn = harness.reads;
    harness.reloadGate = reload.promise;
    expect(host.querySelector("[data-will-answers]")).not.toBeNull();

    enter(field, "The leadership team needs to decide");
    send(field);
    await flush();

    expect(ownWords("The leadership team needs to decide")).toHaveLength(1);
    const query = harness.query.mock.calls[0]![0] as {
      clientId: string;
      clientCreatedAt: string;
    };
    expect(query).toEqual(expect.objectContaining({
      question: "The leadership team needs to decide",
      sessionId: "take-a",
      place: "speaking",
      persist: true,
      history: [{ role: "assistant", content: "Who needs to act on this?" }],
    }));
    const optimistic = harness.appended.find((message) => message.role === "user")!;
    expect(query.clientId).toBe(optimistic.client_id);
    expect(query.clientCreatedAt).toBe(optimistic.client_created_at);

    await act(async () => request.resolve({
      answer: "Then name that decision explicitly.",
      persisted: true,
      after_take: true,
      row_metadata: {
        will_question_step: "thanks",
        backend_marker: "kept",
      },
    }));
    await flush();
    expect(harness.reads).toBeGreaterThan(readsBeforeTurn);
    const localReply = harness.visible.find(
      (message) => message.role === "bot" && message.body === "Then name that decision explicitly.",
    );
    expect(localReply?.metadata).toEqual(expect.objectContaining({
      will_question_step: "thanks",
      backend_marker: "kept",
    }));
    expect(harness.appended.filter((message) => message.role === "bot")).toHaveLength(0);

    harness.rows = [
      QUESTION,
      {
        ...optimistic,
        metadata: {
          ...optimistic.metadata,
          will_question_step: "answer",
        },
      },
      {
        client_id: "reply-a",
        client_created_at: "2026-11-16T10:00:02.000Z",
        role: "bot",
        kind: "text",
        body: "Then name that decision explicitly.",
        metadata: {
          arc_id: "arc-a",
          take_session_id: "take-a",
          will_question_step: "thanks",
          backend_marker: "kept",
          place: "speaking",
        },
      },
    ];
    harness.reloadGate = null;
    await act(async () => reload.resolve());
    await flush();
    expect(ownWords("The leadership team needs to decide")).toHaveLength(1);
    expect(host.textContent).toContain("Then name that decision explicitly.");

    expect(optimistic.metadata).toEqual(expect.objectContaining({
      arc_id: "arc-a",
      take_session_id: "take-a",
      reply_to: "question-a",
      place: "speaking",
      typed_project_turn: true,
    }));
  });

  it("restores and retries the exact words with the same client identity after failure", async () => {
    const first = deferred<{ answer: string; persisted: boolean }>();
    const second = deferred<{ answer: string; persisted: boolean; row_metadata: Record<string, unknown> }>();
    harness.query.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const field = await renderLounge();
    const exact = "  Make the owner explicit.  ";
    enter(field, exact);
    send(field);
    await flush();
    expect(ownWords("Make the owner explicit.")).toHaveLength(1);
    const firstQuery = harness.query.mock.calls[0]![0] as { clientId: string; clientCreatedAt: string };

    await act(async () => first.reject(new Error("offline")));
    await flush();
    const restored = host.querySelector('textarea[aria-label="Message Will"]') as HTMLTextAreaElement;
    expect(restored.value).toBe(exact);
    expect(ownWords("Make the owner explicit.")).toHaveLength(1);

    send(restored);
    await flush();
    const secondQuery = harness.query.mock.calls[1]![0] as { clientId: string; clientCreatedAt: string };
    expect(secondQuery.clientId).toBe(firstQuery.clientId);
    expect(secondQuery.clientCreatedAt).toBe(firstQuery.clientCreatedAt);
    const optimistic = harness.appended.find((message) => message.client_id === firstQuery.clientId)!;
    harness.rows = [
      QUESTION,
      optimistic,
      {
        client_id: "reply-retry",
        client_created_at: "2026-11-16T10:00:03.000Z",
        role: "bot",
        kind: "text",
        body: "Name the owner in the final line.",
        metadata: {
          arc_id: "arc-a",
          take_session_id: "take-a",
          will_question_step: "thanks",
          place: "speaking",
        },
      },
    ];
    await act(async () => second.resolve({
      answer: "Name the owner in the final line.",
      persisted: true,
      row_metadata: { will_question_step: "thanks" },
    }));
    await flush();
    expect(ownWords("Make the owner explicit.")).toHaveLength(1);
    expect(harness.appended.filter((message) => message.client_id === firstQuery.clientId)).toHaveLength(1);
  });

  it("does not reload away a 200 response whose turn was not persisted", async () => {
    harness.query.mockResolvedValue({
      answer: "The model answered without durable rows.",
      persisted: false,
      row_metadata: { will_question_step: "thanks" },
    });
    const field = await renderLounge();
    const readsBeforeTurn = harness.reads;
    const exact = "  Keep this exact draft.  ";
    enter(field, exact);
    send(field);
    await flush();

    const firstQuery = harness.query.mock.calls[0]![0] as { clientId: string; clientCreatedAt: string };
    const restored = host.querySelector('textarea[aria-label="Message Will"]') as HTMLTextAreaElement;
    expect(restored.value).toBe(exact);
    expect(ownWords("Keep this exact draft.")).toHaveLength(1);
    expect(host.textContent).not.toContain("The model answered without durable rows.");
    expect(harness.reads).toBe(readsBeforeTurn);

    send(restored);
    await flush();
    const secondQuery = harness.query.mock.calls[1]![0] as { clientId: string; clientCreatedAt: string };
    expect(secondQuery.clientId).toBe(firstQuery.clientId);
    expect(secondQuery.clientCreatedAt).toBe(firstQuery.clientCreatedAt);
    expect(harness.appended.filter((message) => message.client_id === firstQuery.clientId)).toHaveLength(1);
  });
});
