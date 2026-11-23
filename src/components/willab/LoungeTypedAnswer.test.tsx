// @vitest-environment jsdom
/*
STORY    As a speaker answering Will in the main speaking chat, I see my own
         words immediately and never lose them to a slow or failed model call.
OUTCOME  O1  The open project question keeps its composer, uses contextual
             chat, preserves project/place identity, and reconciles one bubble.
         O2  Typed and tapped turns have one unambiguous pending state; a
             refusal keeps the accepted words and shows a recoverable error.
         O3  The accepted bubble and reply are scrolled into view, structured
             replies cannot replace the turn, and stale terminal walk copy is
             rejected as a new answer.
         O4  The general coach keeps old advice as text and shows the weekly
             note while project artifacts stay inside the project.
PROVES   O1 -> "uses backend-owned persistence, keeps authoritative metadata locally, and reconciles once"
         O2 -> "keeps a refused quick choice once with an explicit recoverable error"
         O3 -> "keeps a structured contextual turn ordered through refresh and scrolls both sides into view"
         O3 -> "does not replay an old terminal walk line as the answer to a new message"
         O4 -> "keeps old suggested words as text and puts the weekly note in Speaking Coach"
WHY      Founder lock N655, 2026-11-16; release-blocking chat audit,
         2026-11-17.
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
  owner: "user-a",
  query: vi.fn(),
  willQuestion: vi.fn(),
  thread: null as ReturnType<typeof import("./useLoungeThread").useLoungeThread> | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/chat",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "token") }));
vi.mock("./useUserId", () => ({ useUserId: () => harness.owner }));
vi.mock("./useSignedIn", () => ({ useSignedIn: () => true }));
vi.mock("@/services/api/chatQuery", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  postChatQuery: (...args: unknown[]) => harness.query(...args),
}));
vi.mock("@/services/api/willQuestion", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  postWillQuestion: (...args: unknown[]) => harness.willQuestion(...args),
}));
// The lounge warms these after boot. Left real, the Ideal Text walk is still
// loading when this file's environment is torn down, and Vitest fails the run
// even though every test passed.
vi.mock("./IdealTextOverlay", () => ({ default: () => null }));
vi.mock("./walk/WalkOverlay", () => ({ default: () => null }));
vi.mock("@/components/life/LifeChatLayer", () => ({ LifeChatCard: () => null }));

import Lounge from "./Lounge";
import { LoungeThreadProvider, useLoungeThreadCtx } from "./LoungeThreadContext";
import { setOpenPlace } from "./chats/loungePlace";
import { writeExploreArc } from "@/lib/willab/exploreArc";

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
  harness.thread = useLoungeThreadCtx();
  harness.visible = harness.thread.messages;
  return null;
}

beforeEach(() => {
  harness.rows = [QUESTION];
  harness.appended = [];
  harness.visible = [];
  harness.reloadGate = null;
  harness.reads = 0;
  harness.owner = "user-a";
  harness.thread = null;
  harness.query.mockReset();
  harness.willQuestion.mockReset().mockResolvedValue(true);
  localStorage.clear();
  sessionStorage.clear();
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

async function renderLounge(signedIn = true, projectConversations = false): Promise<HTMLTextAreaElement> {
  await act(async () => root.render(
    <LoungeThreadProvider signedIn={signedIn}>
      <ThreadProbe />
      <Lounge state={"lounge_idle" as never} onStart={() => undefined} dispatch={() => undefined}
        onProjectTakeReady={projectConversations ? vi.fn() : undefined} />
    </LoungeThreadProvider>,
  ));
  return waitForComposer();
}

function scrollMetrics(element: HTMLElement, height = 1_200): { setHeight: (next: number) => void } {
  let scrollHeight = height;
  Object.defineProperty(element, "scrollHeight", { configurable: true, get: () => scrollHeight });
  Object.defineProperty(element, "clientHeight", { configurable: true, get: () => 320 });
  return { setHeight: (next) => { scrollHeight = next; } };
}

describe("typed answer in the main Will/Lounge chat", () => {
  it("keeps project questions out of the general Speaking Coach conversation and its reply context", async () => {
    harness.rows.push({ ...QUESTION, client_id: "general-advice", body: "A deliberate pause helps.", metadata: { place: "speaking" } });
    harness.query.mockResolvedValue({ answer: "Give the main point room to land." });
    const field = await renderLounge(true, true);
    expect(host.textContent).toContain("A deliberate pause helps.");
    expect(host.textContent).not.toContain(QUESTION.body);
    expect(host.querySelector("[data-will-answers]")).toBeNull();
    enter(field, "When should I slow down?");
    send(field);
    await flush();
    expect(harness.query.mock.calls[0][0].history).toEqual([{ role: "assistant", content: "A deliberate pause helps." }]);
  });

  it("keeps old suggested words as text and puts the weekly note in Speaking Coach", async () => {
    const doc = "https://www.willpowerlab.com/chat?idealArc=00000000-0000-4000-8000-000000000001";
    harness.rows.push({
      ...QUESTION, client_id: "old-wording", body: `Say it directly.\n\nIdeal Text ${doc}`,
      metadata: { place: "speaking", coach_wording: { words: "I recommend the pilot.", delivery: "Pause before the request." } },
    }, {
      ...QUESTION, client_id: "weekly-note", body: "A theme for this week is to state your ask early.",
      metadata: { place: "principles", arc_id: "arc-a", sunday_step: "suggested", sunday_note_id: "week-a" },
    });
    await renderLounge(true, true);
    expect(host.textContent).toContain("I recommend the pilot.");
    expect(host.textContent).toContain("Pause before the request.");
    expect(host.textContent).toContain("A theme for this week is to state your ask early.");
    expect(host.querySelector("[data-coach-wording]")).toBeNull();
    expect(host.querySelector(`a[href="${doc}"]`)).toBeNull();
  });

  it("retries the guest's local write after refresh without generating the answer again", async () => {
    const { LOUNGE_LOCAL_KEY, readLocalLoungeThread } = await import("@/lib/funnel/loungeLocalThread");
    const original = Storage.prototype.setItem;
    let refuse = true;
    const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (refuse && key === LOUNGE_LOCAL_KEY && value.includes("Start at the opening.")) {
        throw new Error("Storage full");
      }
      original.call(this, key, value);
    });
    try {
      harness.query.mockResolvedValue({ answer: "Start at the opening." });
      const field = await renderLounge(false);
      enter(field, "Where do I start?");
      send(field);
      await flush();
      expect(readLocalLoungeThread().map((m) => m.role)).toEqual(["user"]);
      expect(host.querySelector("[data-chat-turn-error]")).toBeTruthy();
      act(() => root.unmount());
      root = createRoot(host);
      refuse = false;
      await renderLounge(false);
      act(() => host.querySelector<HTMLButtonElement>("[data-chat-turn-error] button")!.click());
      await flush();
      expect(readLocalLoungeThread().map((m) => m.role)).toEqual(["user", "bot"]);
      expect(ownWords("Where do I start?")).toHaveLength(1);
      expect(harness.query).toHaveBeenCalledTimes(1);
      expect(host.querySelector("[data-chat-turn-error]")).toBeNull();
    } finally {
      storage.mockRestore();
    }
  });

  it("keeps the original scoped HTTP turn through failure and remount, and reconciles an early server reply once", async () => {
    const projectWord = { ...QUESTION, body: "A project answer", metadata: {
      projectId: "arc-a", typed_project_turn: true, will_question_step: "reply", private_detail: "off wire",
    } };
    const otherProject = { ...projectWord, client_id: "b", body: "Other project", metadata: {
      project_id: "arc-b", typed_project_turn: true, will_question_step: "reply",
    } };
    harness.rows = [projectWord, otherProject];
    const api = await vi.importActual<typeof import("@/services/api/chatQuery")>("@/services/api/chatQuery");
    harness.query.mockImplementation(api.postChatQuery);
    const requests: { history: unknown[]; client_id: string; client_created_at: string }[] = [];
    const first = deferred<Response>();
    const retry = deferred<Response>();
    const original = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).endsWith("/chat/query")) return original(input, init);
      requests.push(JSON.parse(String(init?.body)));
      return requests.length === 1 ? first.promise : retry.promise;
    });
    const field = await renderLounge();
    const words = "What changed in my opening?";
    enter(field, "  " + words + "  ");
    send(field);
    await flush();
    expect(requests[0]).toMatchObject({ question: words, place: "speaking", persist: true, history_source: "screen" });
    expect(requests[0].history).toEqual([
      { role: "assistant", content: "A project answer", metadata: { arc_id: "arc-a" } },
      { role: "assistant", content: "Other project", metadata: { arc_id: "arc-b" } },
    ]);
    await act(async () => harness.thread!.reload());
    expect(ownWords(words)).toHaveLength(1);
    await act(async () => first.resolve(new Response("{}", { status: 504 })));
    expect(host.querySelector("[data-chat-turn-error] button")).toBeTruthy();
    expect(harness.appended.filter((m) => m.role === "bot")).toHaveLength(0);

    // The first server page still has neither half of the turn. A fresh
    // provider and composer have only tab storage to recover it from.
    act(() => root.unmount());
    root = createRoot(host);
    harness.owner = "another-speaker";
    await renderLounge();
    expect(ownWords(words)).toHaveLength(0);
    expect(host.querySelector("[data-chat-turn-error]")).toBeNull();
    harness.owner = "user-a";
    await renderLounge();
    expect(ownWords(words)).toHaveLength(1);
    const button = host.querySelector<HTMLButtonElement>("[data-chat-turn-error] button")!;
    act(() => { button.click(); button.click(); });
    await flush();
    expect(requests).toEqual([requests[0], requests[0]]);

    const user = harness.appended.find((m) => m.client_id === requests[0].client_id)!;
    const bot = { ...user, client_id: "stored-bot", role: "bot" as const, body: "Your opening is clearer.",
      metadata: { place: "speaking", reply_to_client_id: user.client_id } };
    harness.rows.push(user, bot);
    await act(async () => harness.thread!.reload());
    await act(async () => retry.resolve(Response.json({
      answer: bot.body, persisted: true, persisted_client_id: bot.client_id,
    })));
    expect(harness.visible.filter((m) => m.client_id === bot.client_id)).toHaveLength(1);
    act(() => root.unmount());
    root = createRoot(host);
    await renderLounge();
    expect(ownWords(words)).toHaveLength(1);
    expect(host.textContent?.split(bot.body)).toHaveLength(2);
    expect(host.querySelector("[data-chat-turn-error]")).toBeNull();
    expect(requests).toHaveLength(2);
  });

  it("settles a send interrupted by navigation from the server row without resending it", async () => {
    harness.rows = [];
    const request = deferred<never>();
    harness.query.mockReturnValue(request.promise);
    const field = await renderLounge();
    enter(field, "Keep this turn");
    send(field);
    await flush();
    const user = harness.appended[0]!;
    act(() => root.unmount());
    await act(async () => request.reject(new Error("lost response")));
    harness.rows = [user, { ...user, client_id: "reply", role: "bot", body: "Here it is.",
      metadata: { reply_to_client_id: user.client_id, place: "speaking" } }];
    root = createRoot(host);
    await renderLounge();
    expect(ownWords(user.body)).toHaveLength(1);
    expect(host.textContent?.split("Here it is.")).toHaveLength(2);
    expect(host.querySelector("[data-chat-turn-error]")).toBeNull();
    expect(harness.query).toHaveBeenCalledTimes(1);
  });

  it("keeps an acknowledged reply through a stale first page and removes the receipt on the server echo", async () => {
    harness.rows = [];
    harness.query.mockResolvedValue({ persisted: true, persisted_client_id: "ack", answer: "A clear opening." });
    const field = await renderLounge();
    enter(field, "How was it?");
    send(field);
    await flush();
    act(() => root.unmount());
    root = createRoot(host);
    await renderLounge();
    expect(ownWords("How was it?")).toHaveLength(1);
    expect(host.textContent?.split("A clear opening.")).toHaveLength(2);
    expect(host.querySelector("[data-chat-turn-error]")).toBeNull();
    const user = harness.appended[0]!;
    harness.rows = [user, { ...user, id: "database-row", client_id: "ack", role: "bot", body: "A clear opening." }];
    await act(async () => harness.thread!.reload());
    expect(host.textContent?.split("A clear opening.")).toHaveLength(2);
    expect(Object.keys(sessionStorage).filter((key) => key.startsWith("willab.chat.pending"))).toEqual([]);
    expect(harness.query).toHaveBeenCalledTimes(1);
  });

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
    expect(host.querySelector("[data-will-answers]")).toBeNull();
    expect(host.querySelectorAll("[data-typing-dots]")).toHaveLength(1);
    expect(harness.willQuestion).toHaveBeenCalledWith("arc-a", "take-a", "Leadership");

    await act(async () => request.resolve(true));
    await flush();
    expect(ownWords("Leadership")).toHaveLength(1);
    expect(host.textContent).toContain("That helps me understand the context.");
  });

  it("keeps a refused quick choice once with an explicit recoverable error", async () => {
    harness.willQuestion.mockResolvedValue(false);
    await renderLounge();
    const leadership = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Leadership",
    )!;
    act(() => leadership.click());
    await flush();

    expect(ownWords("Leadership")).toHaveLength(1);
    expect(harness.appended.filter(
      (message) => message.role === "user" && message.body === "Leadership",
    )).toHaveLength(1);
    expect(host.textContent).toContain("I'm having trouble reaching the lab right now.");
    expect(host.querySelectorAll("[data-typing-dots]")).toHaveLength(0);
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
    expect(field.disabled).toBe(false);
    expect(field.form?.getAttribute("aria-busy")).toBe("true");
    expect(host.querySelectorAll("[data-typing-dots]")).toHaveLength(1);
    const query = harness.query.mock.calls[0]![0] as {
      clientId: string;
      clientCreatedAt: string;
    };
    expect(query).toEqual(expect.objectContaining({
      question: "The leadership team needs to decide",
      sessionId: "take-a",
      place: "speaking",
      persist: true,
      history: [{ role: "assistant", metadata: { arc_id: "arc-a" }, content: "Who needs to act on this?" }],
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
    expect((host.querySelector('textarea[aria-label="Message Will"]') as HTMLTextAreaElement).disabled).toBe(false);

    expect(optimistic.metadata).toEqual(expect.objectContaining({
      arc_id: "arc-a",
      take_session_id: "take-a",
      reply_to: "question-a",
      place: "speaking",
      typed_project_turn: true,
    }));
  });

  it("keeps a structured contextual turn ordered through refresh and scrolls both sides into view", async () => {
    harness.rows = [];
    setOpenPlace("will");
    const request = deferred<{
      answer: string;
      persisted: boolean;
      suggested_action: "trainings";
    }>();
    harness.query.mockReturnValue(request.promise);
    const field = await renderLounge();
    const thread = host.querySelector("[data-thread]") as HTMLDivElement;
    const metrics = scrollMetrics(thread);
    thread.scrollTop = 0;

    enter(field, "did you spot any patterns?");
    send(field);
    await flush();

    expect(ownWords("did you spot any patterns?")).toHaveLength(1);
    expect(thread.scrollTop).toBe(1_200);
    expect(harness.query).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll("[data-typing-dots]")).toHaveLength(1);

    thread.scrollTop = 0;
    metrics.setHeight(1_600);
    await act(async () => request.resolve({
      answer: "Yes, actually—we did spot a pattern.",
      persisted: true,
      suggested_action: "trainings",
    }));
    await flush();

    const own = ownWords("did you spot any patterns?")[0]!;
    const reply = [...host.querySelectorAll("[data-row='app']")].find(
      (node) => node.textContent === "Yes, actually—we did spot a pattern.",
    )!;
    expect(Boolean(own.compareDocumentPosition(reply) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(host.textContent).toContain("Your projects");
    expect(thread.scrollTop).toBe(1_600);
    expect(host.querySelectorAll("[data-typing-dots]")).toHaveLength(0);

    const optimistic = harness.appended.find((message) => message.role === "user")!;
    harness.rows = [
      optimistic,
      {
        client_id: "pattern-reply",
        client_created_at: "2026-11-17T10:00:02.000Z",
        role: "bot",
        kind: "text",
        body: "Yes, actually—we did spot a pattern.",
        metadata: { suggested_action: "trainings", place: "will" },
      },
    ];
    await act(async () => harness.thread!.reload());
    await flush();
    expect(ownWords("did you spot any patterns?")).toHaveLength(1);
    expect(host.textContent).toContain("Yes, actually—we did spot a pattern.");
  });

  it("shows free-form Speaking-coach words immediately even when a project is current", async () => {
    harness.rows = [];
    writeExploreArc("user-a", "arc-current", 2);
    const request = deferred<{ answer: string; persisted: boolean }>();
    harness.query.mockReturnValue(request.promise);
    const field = await renderLounge();
    const thread = host.querySelector("[data-thread]") as HTMLDivElement;
    const metrics = scrollMetrics(thread);
    thread.scrollTop = 0;

    enter(field, "Hi");
    send(field);
    await flush();

    expect(ownWords("Hi")).toHaveLength(1);
    expect(thread.scrollTop).toBe(1_200);
    expect(host.querySelectorAll("[data-typing-dots]")).toHaveLength(1);
    const optimistic = harness.appended.find(
      (message) => message.role === "user" && message.body === "Hi",
    )!;
    expect(optimistic.metadata).toEqual(expect.objectContaining({ place: "speaking" }));
    expect(optimistic.metadata).not.toHaveProperty("arc_id");

    thread.scrollTop = 0;
    metrics.setHeight(1_600);
    await act(async () => request.resolve({
      answer: "Hi! What would you like to practise?",
      persisted: true,
    }));
    await flush();
    expect(host.textContent).toContain("Hi! What would you like to practise?");
    expect(ownWords("Hi")).toHaveLength(1);
    expect(thread.scrollTop).toBe(1_600);
  });

  it("does not replay an old terminal walk line as the answer to a new message", async () => {
    setOpenPlace("will");
    harness.rows = [{
      client_id: "old-goodbye",
      client_created_at: "2026-11-17T09:00:00.000Z",
      role: "bot",
      kind: "text",
      body: "Good job. See you next time.",
      metadata: { next_take: true, arc_id: "arc-a", take_session_id: "take-a" },
    }];
    harness.query.mockResolvedValue({
      answer: "Good job. See you next time.",
      persisted: true,
    });
    const field = await renderLounge();
    enter(field, "What should I practise next?");
    send(field);
    await flush();

    expect(ownWords("What should I practise next?")).toHaveLength(1);
    expect(host.textContent).not.toContain("Good job. See you next time.");
    expect(host.textContent).toContain("I'm having trouble reaching the lab right now.");
    expect((host.querySelector('textarea[aria-label="Message Will"]') as HTMLTextAreaElement).value)
      .toBe("What should I practise next?");
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
