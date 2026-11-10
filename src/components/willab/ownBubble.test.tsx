// @vitest-environment jsdom
/*
 * STORY    As a speaker, when I tap an answer or send what I typed, I want my
 *          own bubble on screen at once and kept there while the answer is
 *          on its way, so that I know it went (backend N632 item 7, the
 *          founder on a phone, 10 November 2026: "it disappears, and then
 *          the posted bubble by me appears when the answer appears").
 * OUTCOME
 *   B1  A tap under Will's question ("When is it?" → "No date yet"): the
 *       bubble shows before the backend answers, stays, and once the
 *       backend's row is read it is there exactly once.
 *   B2  Words typed to Will: the bubble shows at once and a read of the
 *       thread that lands while it is still being sent keeps it; it is
 *       there exactly once after.
 *   B3  A tap on a host's join question in a person's chat ("Are you in a
 *       hurry?" → "No"): the bubble shows before the backend answers, the
 *       answers go, and the backend's row takes its place exactly once; a
 *       refused answer takes it away and the answers come back.
 * WHY      backend N632 item 7; docs/flows/feedback-walk-and-chat.md.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { Plan } from "@/services/api/plan";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Page = { messages: LoungeMessage[]; has_more: boolean; oldest_cursor: string | null; failed?: boolean };
const server = vi.hoisted(() => ({ rows: [] as LoungeMessage[], appendHeld: null as Promise<void> | null }));
const page = (): Page => ({ messages: [...server.rows], has_more: false, oldest_cursor: null });
vi.mock("@/services/api/bootPrefetch", () => ({ takeLoungeHistory: vi.fn(async () => page()) }));
vi.mock("@/services/api/loungeMessages", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchLoungeHistory: vi.fn(async () => page()),
  appendLoungeMessages: vi.fn(async (rows: LoungeMessage[]) => {
    if (server.appendHeld) await server.appendHeld;
    server.rows.push(...rows);
    return rows;
  }),
}));
type Reply = { kind: string; ok: boolean; body: unknown };
const bffFetch = vi.hoisted(() => vi.fn(async (_url: string, _init?: unknown): Promise<Reply> => ({ kind: "response", ok: true, body: {} })));
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));

import { useLoungeThread } from "./useLoungeThread";
import { usePlanLounge } from "./plan/usePlanLounge";
import { planRowFor } from "./plan/PlanRows";
import ChatThread from "./chats/ChatThread";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  server.rows = [];
  server.appendHeld = null;
  bffFetch.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const flush = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
function held<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
const mine = () => [...host.querySelectorAll("[data-mine], [data-row='me']")].map((el) => el.textContent ?? "");
const tapOn = async (label: string) => {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent === label);
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
  await flush();
};

// ── Will's chat ────────────────────────────────────────────────────────────

const row = (id: string, role: "bot" | "user", body: string, at: string, meta: Record<string, unknown> | null = null): LoungeMessage => ({
  client_id: id,
  role,
  kind: "text",
  body,
  metadata: meta,
  client_created_at: at,
});
const WHEN = row("w-when", "bot", "When is it?", "2026-11-10T10:00:00.000Z", {
  plan: "plan-1",
  way_in: "talk_date",
  chips: ["Pick a date", "No date yet"],
  plan_ask: "way_in_date",
});
const PLAN = {
  id: "plan-1",
  status: "asking",
  step: "deadline",
  deadline: null,
  total: 0,
  done: 1,
  calls: { kickoff: null, summary: null },
  first_take_done: true,
  waiting: true,
  first_take: true,
  way_in: { asking: "talk_date", done: [], chosen: null, talk_date: null, walk_ready: false, walk_done: false, record_next: false },
} as unknown as Plan;

const threadRef: { current: ReturnType<typeof useLoungeThread> | null } = { current: null };
function WillChat() {
  const thread = useLoungeThread(true);
  threadRef.current = thread;
  const plan = usePlanLounge({ signedIn: true, thread, setThinking: () => {}, recordHeld: false });
  return (
    <div>
      {thread.messages.map((m) =>
        m.role === "user" ? (
          <div key={m.client_id} data-mine="">
            {m.body}
          </div>
        ) : (
          <div key={m.client_id}>{planRowFor(m, plan.rows) ?? m.body}</div>
        ),
      )}
      {plan.asks}
    </div>
  );
}

describe("one's own bubble in Will's chat (backend N632 item 7)", () => {
  it("B1: a tap under Will's question shows its bubble before the answer, and once after", async () => {
    server.rows = [WHEN];
    const answered = held<Reply>();
    bffFetch.mockImplementation(async (url: string, init?: unknown) => {
      const answer = (init as { json?: { answer?: unknown } } | undefined)?.json?.answer;
      if (url.startsWith("/api/v2/plan/way-in") && answer) return answered.promise;
      if (url.startsWith("/api/v2/plan/way-in")) return { kind: "response", ok: true, body: { plan: PLAN, messages: [] } };
      return { kind: "response", ok: true, body: { enabled: true, plan: PLAN } };
    });
    await act(async () => root.render(<WillChat />));
    await flush();
    await tapOn("No date yet");
    expect(mine()).toEqual(["No date yet"]);

    // A read of the thread that lands while the answer is on its way keeps it.
    await act(async () => threadRef.current!.reload());
    expect(mine()).toEqual(["No date yet"]);

    // The backend writes the answer and Will's next line; the thread is read.
    server.rows = [
      WHEN,
      row("w-a", "user", "No date yet", "2026-11-10T10:00:05.000Z", { plan: "plan-1", way_in: "talk_date", way_in_answer: true }),
      row("w-next", "bot", "Do you accept it?", "2026-11-10T10:00:06.000Z", { plan: "plan-1" }),
    ];
    await act(async () => answered.resolve({ kind: "response", ok: true, body: { plan: PLAN, messages: server.rows.slice(1) } }));
    await flush();
    expect(mine()).toEqual(["No date yet"]);
    expect(host.textContent).toContain("Do you accept it?");
  });

  it("B2: words typed to Will stay on screen through a read while they are sent, and show once", async () => {
    const stored = held<void>();
    server.appendHeld = stored.promise;
    await act(async () => root.render(<WillChat />));
    await flush();
    let sending: Promise<unknown> = Promise.resolve();
    await act(async () => {
      sending = threadRef.current!.append({ role: "user", kind: "text", body: "How do I start?" });
    });
    expect(mine()).toEqual(["How do I start?"]);
    await act(async () => threadRef.current!.reload());
    expect(mine()).toEqual(["How do I start?"]);
    await act(async () => {
      stored.resolve();
      await sending;
    });
    await act(async () => threadRef.current!.reload());
    expect(mine()).toEqual(["How do I start?"]);
  });
});

// ── A chat with a person or a host ─────────────────────────────────────────

type Route = () => Reply | Promise<Reply>;
let routes: Record<string, Route> = {};
const json = (body: unknown, status = 200): Reply => ({ kind: "response", ok: status < 400, body });
const AT = "2026-11-10T10:00:00Z";
const HURRY = {
  id: "q1",
  mine: false,
  author: "Ariel",
  kind: "text",
  body: "Are you in a hurry?",
  meta: { setup: { i: 1, kind: "hurry", answers: ["No", "Yes"], multi: false } },
  created_at: AT,
};

async function openChat(messages: unknown[]) {
  routes = { "GET /api/v2/chats/c-1/messages": () => json({ messages }), "GET /api/v2/chats/c-1/host": () => json({ host: null }) };
  bffFetch.mockImplementation(async (url: string, init?: unknown) => {
    const route = routes[`${(init as { method?: string } | undefined)?.method ?? "GET"} ${url}`];
    return route ? route() : json({ code: "NOT_FOUND" }, 404);
  });
  await act(async () =>
    root.render(createElement(ChatThread, { chat: { id: "c-1", kind: "team", title: "Ariel", subtitle: "", last: null }, onBack: () => undefined })),
  );
  await flush();
}

describe("one's own bubble in a chat with a person (backend N632 item 7)", () => {
  it("B3: a tap on a host's join question shows its bubble before the answer, and once after", async () => {
    await openChat([HURRY]);
    const answered = held<Reply>();
    routes["POST /api/v2/chats/c-1/setup/q1"] = () => answered.promise;
    await tapOn("No");
    expect(mine().filter((t) => t.includes("No"))).toHaveLength(1);
    expect(host.querySelector("[data-chat-setup]")).toBeNull();

    await act(async () =>
      answered.resolve(
        json({
          messages: [
            { id: "a1", mine: true, author: "", kind: "text", body: "No", created_at: AT, meta: { setup_answer: { to: "q1", i: 1, picked: ["No"] } } },
            { id: "q2", mine: false, author: "Ariel", kind: "text", body: "Which languages can we use?", created_at: AT, meta: null },
          ],
        }),
      ),
    );
    await flush();
    expect(mine().filter((t) => t.includes("No"))).toHaveLength(1);
    expect(host.textContent).toContain("Which languages can we use?");
  });

  it("B3: a refused answer takes its bubble away and the answers come back", async () => {
    await openChat([HURRY]);
    routes["POST /api/v2/chats/c-1/setup/q1"] = () => json({ code: "NOT_SAVED" }, 503);
    await tapOn("No");
    expect(mine()).toEqual([]);
    expect(host.querySelector("[data-chat-setup]")).not.toBeNull();
  });
});
