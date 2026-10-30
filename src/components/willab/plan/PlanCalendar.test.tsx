// @vitest-environment jsdom
/*
 * STORY    As a speaker on a plan, I want Will to ask before I book my calls
 *          with my coach, then a big calendar I can swipe through that goes
 *          as soon as I book, so that booking takes a few taps and never
 *          stands between me and my first Take.
 * OUTCOME
 *   O1  Will's ask for a call has "Skip" and "Book now" under it; the
 *       calendar does not open by itself (N281).
 *   O2  "Book now" opens it full screen: the call's name, "0 of 2 booked"
 *       and the deadline; only a day with an open time can be picked, and
 *       Book waits for a time.
 *   O3  Edit moves the deadline from the same screen (N168).
 *   O4  A day, then a time, then Book sends exactly that time, and the
 *       calendar is gone at once.
 *   O5  "Skip" passes the call on without booking it.
 * PROVES   O1 to O4 -> "Book now, a day, a time, then Book"
 *          O5 -> "Skip passes the call on"
 * WHY      The calls' calendar, full screen and asked for first (founder
 *          2026-10-28 and 2026-10-30, backend N248, N281);
 *          docs/flows/the-plan.md §1 F.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Plan } from "@/services/api/plan";
import PlanDock, { type PlanActions } from "./PlanDock";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOON = new Date(2026, 9, 29, 12, 0).toISOString();
const HALF = new Date(2026, 9, 29, 12, 30).toISOString();
const bffFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 9, 28, 9, 0) });
  bffFetch.mockImplementation(async () => ({ kind: "response", ok: true, body: { slots: [NOON, HALF] } }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const PLAN: Plan = {
  id: "plan-1",
  status: "asking",
  step: "kickoff",
  deadline: "2026-11-14",
  deadline_given: true,
  deadline_short: "Sat 14 Nov",
  deadline_day: "14 November",
  days: [1, 3, 5],
  days_text: "Mon, Wed, Fri",
  every_day: false,
  total: 9,
  done: 0,
  level: "key_line",
  level_name: "Let your key line land",
  pace_week: false,
  key_line: null,
  why_line: null,
  key_answer_id: null,
  calls: { kickoff: null, summary: null },
  first_take_done: false,
  next_day: null,
  topic: null,
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

const q = <T extends Element = HTMLButtonElement>(selector: string) => document.querySelector(selector) as T;
const tap = (selector: string) => act(() => q(selector).click());
/** Time passes: Will's words are read, the calendar comes up, a month folds. */
const wait = async (ms: number) => {
  await act(() => vi.advanceTimersByTimeAsync(ms));
  await act(() => vi.advanceTimersByTimeAsync(100));
};

it("Book now, a day, a time, then Book", async () => {
  const a = actions();
  act(() => root.render(<PlanDock plan={PLAN} busy={false} booking={null} onCloseBooking={() => {}} actions={a} />));
  await wait(1100);
  expect(q("[data-plan-calendar]")).toBeNull();
  const ask = [...document.querySelectorAll("[data-plan-dock='call'] button")];
  expect(ask.map((b) => b.textContent)).toEqual(["Skip", "Book now"]);

  act(() => (ask[1] as HTMLButtonElement).click());
  await wait(100);
  const sheet = q("[data-plan-calendar='kickoff']");
  expect(sheet.textContent).toContain("Kickoff call with your coach");
  expect(sheet.textContent).toContain("0 of 2 booked");
  expect(sheet.textContent).toContain("Your deadline: Sat 14 Nov");
  expect(q("[data-plan-day='2026-10-31']").getAttribute("aria-disabled")).toBe("true");
  expect(q("[data-plan-act]").disabled).toBe(true);

  tap("[data-plan-edit-deadline]");
  expect(q("[data-plan-calendar]").textContent).toContain("Your deadline");
  tap("[data-plan-day='2026-11-20']");
  tap("[data-plan-act]");
  expect(a.saveDeadline).toHaveBeenCalledWith("2026-11-20");

  tap("[data-plan-day='2026-10-29']");
  await wait(400);
  expect([...document.querySelectorAll("[data-plan-time]")].map((b) => b.textContent)).toEqual(["12:00", "12:30"]);
  tap(`[data-plan-time='${NOON}']`);
  tap("[data-plan-act]");
  expect(a.book).toHaveBeenCalledWith("kickoff", NOON);
  await wait(600);
  expect(q("[data-plan-calendar]")).toBeNull();
});

it("Skip passes the call on", async () => {
  const a = actions();
  act(() =>
    root.render(<PlanDock plan={{ ...PLAN, step: "summary" }} busy={false} booking={null} onCloseBooking={() => {}} actions={a} />),
  );
  await wait(100);
  tap("[data-plan-dock='call'] button");
  expect(a.book).toHaveBeenCalledWith("summary", null);
  expect(q("[data-plan-calendar]")).toBeNull();
});
