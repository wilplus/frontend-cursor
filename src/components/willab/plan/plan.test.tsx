// @vitest-environment jsdom
/*
 * STORY    As a new speaker on the plan's ring, I want the Lounge to ask me
 *          my questions one at a time in the footer, and to show my plan
 *          as it was drawn, so that I reach my first Take without a form.
 * OUTCOME
 *   O1  Each step of the plan gets its own footer in place of the message
 *       box: the deadline's two chips, "Record your answer" with no Skip,
 *       the 1 to 10 scale, the calls' calendar, then only "Start your
 *       first recording"; with no plan, the message box stays.
 *   O2  A tap on the scale is sent once, and the number is never written
 *       back into the chat (N178).
 *   O3  The plan's rows are drawn by their metadata: the speaker's voice
 *       answer as their own bubble, the card with its list, the deadline
 *       in orange and Book on a call not booked; a plain row is left to
 *       the Lounge.
 *   O4  The chat has one record button: a practice day's one thing holds
 *       it until a newer Take's closing message takes it back (N167), and
 *       gives it up once its Take is recorded (N244).
 *   O5  A new project's question takes Yes or No in the footer (H2), and
 *       "How do you feel?" comes before a Take only once the plan's first
 *       Take is recorded (D4).
 *   O6  Will's ask for the plan's own yes is drawn as his bubble with Read
 *       more, its footer is "Not now" and "Yes, ask me" and nothing else
 *       is taken while he waits (N211).
 *   O7  The principles wait until the plan is read and while it says the
 *       speaker is onboarded; the first Take landing in the thread reads
 *       the plan again and lets them back (N243).
 * PROVES   O1 -> "each step has its own footer"
 *          O2 -> "a rating is sent once and never written back"
 *          O3 -> "the plan's rows are drawn as the prototype draws them"
 *          O4 -> "the newest bubble holds the one record button"
 *          O5 -> "a new project's question, and the feelings before a Take"
 *          O6 -> "Will asks for the plan's own yes"
 *          O7 -> "the principles wait for the first Take"
 * WHY      The plan, built one to one with the prototype (founder
 *          2026-10-26, backend N203, N204); the principles waiting for the
 *          onboarding, backend N243; docs/flows/the-plan.md §1.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { Plan } from "@/services/api/plan";
import { feelingsDue, rememberPlan } from "@/services/api/plan";
import PlanDock, { dockFor, type PlanActions } from "./PlanDock";
import { newestOneOf, planRowFor, type PlanRowCtx } from "./PlanRows";
import { usePlanLounge, type PlanLounge } from "./usePlanLounge";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const bffFetch = vi.hoisted(() =>
  vi.fn(async (_url: string, _init?: unknown): Promise<{ kind: string; ok: boolean; body: unknown }> => ({ kind: "response", ok: true, body: { slots: [] } })),
);
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  bffFetch.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const PLAN: Plan = {
  id: "plan-1",
  status: "asking",
  step: "deadline",
  deadline: "2026-11-14",
  deadline_given: false,
  deadline_short: "Sat 14 Nov",
  deadline_day: "14 November",
  days: [1, 3, 5],
  days_text: "Mon, Wed, Fri",
  every_day: false,
  total: 9,
  done: 0,
  level: "key_line",
  level_name: "Let your key line land",
  pace_week: true,
  key_line: "The window closes once the incumbents match our price.",
  why_line: "It's the sentence you want the board to remember.",
  key_answer_id: "answer-key",
  calls: { kickoff: null, summary: null },
  first_take_done: false,
  next_day: "Monday",
  topic: "Our Q3 board pitch",
  waiting: false,
};

function actions(): PlanActions {
  return {
    deadline: vi.fn(),
    answer: vi.fn(async () => {}),
    rating: vi.fn(),
    book: vi.fn(),
    saveDeadline: vi.fn(),
    startFirst: vi.fn(),
    next: vi.fn(),
    sameEvent: vi.fn(),
    consent: vi.fn(),
  };
}

function row(metadata: Record<string, unknown>, body = "", role: LoungeMessage["role"] = "bot"): LoungeMessage {
  return { client_id: `c-${Math.random()}`, role, kind: "text", body, metadata: { plan: "plan-1", ...metadata }, client_created_at: "2026-10-24T10:00:00Z" };
}

it("each step has its own footer", () => {
  expect(dockFor(null, null)).toBeNull();
  expect(dockFor({ ...PLAN, waiting: true }, null)).toBeNull();
  expect(dockFor(PLAN, null)).toBe("deadline");
  expect(dockFor({ ...PLAN, step: "followup" }, null)).toBe("voice");
  expect(dockFor({ ...PLAN, step: "ready" }, null)).toBe("ready");
  expect(dockFor({ ...PLAN, step: "summary" }, null)).toBe("call");
  expect(dockFor({ ...PLAN, status: "active", step: "done" }, null)).toBe("start");
  expect(dockFor({ ...PLAN, status: "active", step: "done", first_take_done: true }, null)).toBeNull();
  expect(dockFor({ ...PLAN, status: "active", step: "done", first_take_done: true }, "kickoff")).toBe("book");

  act(() => root.render(<PlanDock plan={PLAN} busy={false} booking={null} onCloseBooking={() => {}} actions={actions()} />));
  expect([...host.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Pick a date", "No date yet"]);

  act(() => root.render(<PlanDock plan={{ ...PLAN, step: "why" }} busy={false} booking={null} onCloseBooking={() => {}} actions={actions()} />));
  expect(host.textContent).toContain("Record your answer");
  expect(host.textContent).not.toContain("Skip");

  const a = actions();
  act(() => root.render(<PlanDock plan={{ ...PLAN, status: "active", step: "done" }} busy={false} booking={null} onCloseBooking={() => {}} actions={a} />));
  act(() => (host.querySelector("[data-plan-dock='start']") as HTMLButtonElement).click());
  expect(a.startFirst).toHaveBeenCalledTimes(1);
});

it("a rating is sent once and never written back", () => {
  const a = actions();
  act(() => root.render(<PlanDock plan={{ ...PLAN, step: "stress" }} busy={false} booking={null} onCloseBooking={() => {}} actions={a} />));
  expect(host.textContent).toContain("Calm");
  expect(host.textContent).toContain("Very stressed");
  const seven = host.querySelector("[aria-label='7 of 10']") as HTMLButtonElement;
  act(() => seven.click());
  act(() => seven.click());
  expect(a.rating).toHaveBeenCalledTimes(1);
  expect(a.rating).toHaveBeenCalledWith(7);
});

function ctx(plan: Plan | null = PLAN): PlanRowCtx {
  return { plan, newestOne: null, recordHeld: false, onSeePlan: vi.fn(), onChangePlan: vi.fn(), onBook: vi.fn(), onRecordNext: vi.fn() };
}

it("the plan's rows are drawn as the prototype draws them", () => {
  const plain = row({}, "When is your deadline?");
  expect(planRowFor(plain, ctx())).toBeNull();
  expect(planRowFor(row({ plan_card: true }), undefined)).toBeNull();

  act(() => root.render(<>{planRowFor(row({ plan_voice: "answer-1", duration_ms: 64000 }, "said", "user"), ctx())}</>));
  expect(host.querySelector("[data-plan-voice]")).not.toBeNull();
  expect(host.textContent).toContain("1:04");

  const c = ctx({ ...PLAN, status: "active", step: "done" });
  act(() => root.render(<>{planRowFor(row({ plan_card: true }), c)}</>));
  const card = host.querySelector("[data-plan-card]")!;
  expect(card.textContent).toContain("Your next level");
  expect(card.textContent).toContain("Let your key line land");
  expect(card.textContent).toContain("15 minutes, 3 times a week: Mon, Wed, Fri");
  expect(card.textContent).toContain("This week your walk has a pace game");
  expect(card.textContent).toContain("Your deadline: Sat 14 Nov");
  const books = card.querySelectorAll("[data-plan-book]");
  expect(books.length).toBe(2);
  act(() => (books[0] as HTMLButtonElement).click());
  expect(c.onBook).toHaveBeenCalledWith("kickoff");
});

it("the newest bubble holds the one record button", () => {
  const closing = { ...row({}), metadata: { next_take: true, arc_id: "arc-1", take_index: 1 } };
  const one = row({ plan_one: true, arc_id: "arc-1", take_index: 1 }, "Today, one thing: say your key line a little slower than the rest. You've got this 💪");
  expect(newestOneOf([closing, one])).toBe(one.client_id);
  expect(newestOneOf([one, closing])).toBeNull();
  const recorded = { ...row({ arc_id: "arc-1", take_index: 2 }), kind: "recording_summary" as const };
  expect(newestOneOf([closing, one, recorded])).toBeNull();

  const c = { ...ctx({ ...PLAN, status: "active", step: "done", first_take_done: true }), newestOne: one.client_id };
  act(() => root.render(<>{planRowFor(one, c)}</>));
  const record = host.querySelector("[data-plan-record]") as HTMLButtonElement;
  expect(record.textContent).toContain("Record Take 2");
  act(() => record.click());
  expect(c.onRecordNext).toHaveBeenCalledWith("arc-1");
});

it("a new project's question, and the feelings before a Take", () => {
  const active: Plan = { ...PLAN, status: "active", step: "same_event", first_take_done: true };
  expect(dockFor(active, null)).toBe("same_event");
  const a = actions();
  act(() => root.render(<PlanDock plan={active} busy={false} booking={null} onCloseBooking={() => {}} actions={a} />));
  const no = [...host.querySelectorAll("button")].find((b) => b.textContent === "No") as HTMLButtonElement;
  act(() => no.click());
  expect(a.sameEvent).toHaveBeenCalledWith(false);

  rememberPlan(null);
  expect(feelingsDue()).toBe(false);
  rememberPlan({ ...PLAN, status: "active", step: "done", first_take_done: false });
  expect(feelingsDue()).toBe(false);
  rememberPlan({ ...PLAN, status: "active", step: "done", first_take_done: true });
  expect(feelingsDue()).toBe(true);
  rememberPlan(null);
});

it("Will asks for the plan's own yes", () => {
  const waiting: Plan = { ...PLAN, step: "consent" };
  expect(dockFor(waiting, null)).toBe("consent");
  const a = actions();
  act(() => root.render(<PlanDock plan={waiting} busy={false} booking={null} onCloseBooking={() => {}} actions={a} />));
  const labels = [...host.querySelectorAll("button")].map((b) => b.textContent);
  expect(labels).toEqual(["Not now", "Yes, ask me"]);
  act(() => (host.querySelectorAll("button")[1] as HTMLButtonElement).click());
  act(() => (host.querySelectorAll("button")[0] as HTMLButtonElement).click());
  expect(a.consent).toHaveBeenNthCalledWith(1, true);
  expect(a.consent).toHaveBeenNthCalledWith(2, false);

  const ask = "A few of my questions are personal: how stressed and how ready you feel, what worries you, and how you feel before each Take.";
  act(() => root.render(<>{planRowFor(row({ plan_ask: "consent" }, ask), ctx(waiting))}</>));
  expect(host.querySelector("[data-bubble]")?.textContent).toContain(ask);
  expect([...host.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Read more"]);
});

it("the principles wait for the first Take", async () => {
  let onboarding = true;
  bffFetch.mockImplementation(async (url: string) => ({
    kind: "response",
    ok: true,
    body: url.startsWith("/api/v2/plan")
      ? { enabled: true, wrote: false, plan: { ...PLAN, status: "active", step: "done", first_take_done: !onboarding, onboarding } }
      : { slots: [] },
  }));
  let lounge: PlanLounge | null = null;
  const reload = async () => {};
  function Harness({ messages }: { messages: LoungeMessage[] }) {
    lounge = usePlanLounge({
      signedIn: true,
      thread: { messages, loading: false, reload },
      setThinking: () => {},
      onRecordNext: () => {},
      recordHeld: false,
    });
    return null;
  }
  const render = async (messages: LoungeMessage[]) => {
    await act(async () => root.render(<Harness messages={messages} />));
    await act(async () => {});
  };

  act(() => root.render(<Harness messages={[]} />));
  expect(lounge!.holdsPrinciples).toBe(true); // the plan not read yet
  await render([]);
  expect(lounge!.holdsPrinciples).toBe(true); // the plan card, before the first Take

  onboarding = false;
  await render([{ client_id: "take-1", role: "bot", kind: "text", body: "", metadata: { arc_id: "arc-1", take_index: 1 }, client_created_at: "2026-10-28T10:00:00Z" }]);
  expect(lounge!.holdsPrinciples).toBe(false);
});
