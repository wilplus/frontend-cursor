// @vitest-environment jsdom
/*
 * STORY    As a new speaker on the plan's ring, I want Will to ask me my
 *          questions one at a time the way he asks after the walk, and to
 *          show my plan as it was drawn, so that I reach my first Take
 *          without a form.
 * OUTCOME
 *   O1  A choice (the deadline, the plan's own yes, a new project's
 *       question) is tap answers on the right of the thread, Will's orange
 *       pills, the plan's "Not now" a grey word (N467); the Lounge's bar
 *       stays under it, the stack and its one black button, and a tap sends
 *       that answer (N319 item 1, N483 item 2).
 *   O2  A spoken question makes the bar's middle "Record your answer", with
 *       "Not now" under the question (N483 item 2); a tap records with the
 *       one recording bar in the bar's place (the trash on the left, Stop
 *       inside the strip, no send), the trash throws it away, and Stop sends
 *       the answer to the plan (N319 item 1, N314). "Not now" leaves it: the
 *       middle goes back to the record button until the chat is opened
 *       again.
 *   O3  The 1 to 10 scale sits in the thread under its question; a tap is
 *       sent once, and the number is never written back into the chat
 *       (N178): the tap comes back as my turn, a lock and "Answered"
 *       (N339).
 *   O4  One action a step: the plan's questions never cover the next Take
 *       (N483 item 2); before the first Take the bar's middle is "Start your
 *       first recording", which opens the plan's first Take. A Take recorded
 *       first: its walk comes before the questions (N262).
 *   O5  While the plan asks there is no box to type in: the answer is a tap
 *       or your voice (N319 item 3, N483 item 7: the faded "Type here" and
 *       its note are gone).
 *   O6  The plan's rows are drawn by their metadata: the speaker's voice
 *       answer as their own bubble; the card as the plan only (N319 item
 *       6): "Plan", its bar, the practice days, the deadline and "Change
 *       your plan", with no level, key line or call; "See your plan" adds
 *       this week's level; the plan's progress after the walk as Will's
 *       bubble with its bar and "{n} of {total} practices done." (N319
 *       item 7); a plain row is left to the Lounge.
 *   O7  The chat has one record button: a practice day's one thing holds
 *       it until a newer Take's closing message takes it back (N167), and
 *       gives it up once a newer Take is recorded, in any project (N244,
 *       N251). It is "Record Take N", the bar's middle beside the stack,
 *       never inside the bubble, and a tap starts that Take (N294 item 7,
 *       N483 item 2: no ✕ beside it).
 *   O8  "How do you feel?" comes before a Take only once the plan's first
 *       Take is recorded (D4).
 *   O9  Will's ask for the plan's own yes is drawn as his bubble with Read
 *       more (N211).
 *   O10 Before my first Take nothing of the principles is in my way: no
 *       ask opens; once my first Take lands it does, without opening the app
 *       again (N243). The voice notebook itself rests (N483 item 7).
 *   O11 The plan's coach calls are hidden, not removed (N315): with the
 *       ring row "plan_calls" on, the card lists both calls, Book on one
 *       not booked, and the plan's end shows the summary call; off, none.
 *   O12 On a first-Take plan (backend N401, the ring row "first_take"),
 *       nothing is asked in the chat: "Start your first recording" is the
 *       bar's middle at once, and it starts the first Take with the plan's
 *       five slides.
 * PROVES   O1, O5 -> "a choice is taps in the thread, and the bar keeps its
 *                     one button"
 *          O2 -> "a spoken question: Record your answer records it, Not now
 *                 leaves it"
 *          O3 -> "a rating is sent once and never written back"
 *          O4 -> "the plan's questions never cover Start your first recording"
 *          O3, O6 -> "the plan's rows are drawn as the prototype draws them"
 *          O7 -> "a practice day's Record Take N is the bar's middle"
 *          O8 -> "the feelings before a Take"
 *          O9 -> "Will asks for the plan's own yes"
 *          O10 -> "nothing of the principles before my first Take"
 *          O11 -> "the plan's calls show only with their ring row"
 *          O12 -> "a first-Take plan: the bar's button at once, and it starts the five slides"
 * WHY      The plan, built one to one with the prototype (founder
 *          2026-10-26, backend N203, N204); the principles waiting for the
 *          onboarding, backend N243; record first, backend N262; every
 *          question the after-walk way, one action a step, typing waits
 *          before Take 1, backend N319 items 1 to 3, its note signed, backend
 *          N323 item 1, and on a choice, backend N325 item 4, wherever the
 *          box is faded, backend N350 item 4; the calls hidden, backend
 *          N315; the plan card simplified, backend N319 item 6; no bubble
 *          carries a button, backend N294 item 7; one bar in every chat,
 *          backend N483; docs/flows/the-plan.md §1.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { Plan } from "@/services/api/plan";
import { feelingsDue, rememberPlan } from "@/services/api/plan";
import { loadRingState, resetRingStateCache } from "@/services/api/rings";
import { PlanAsk, WillBarMiddle, type PlanActions } from "./PlanDock";
import { planRowFor, type PlanRowCtx } from "./PlanRows";
import { SeePlanSheet } from "./PlanSheet";
import { usePlanLounge } from "./usePlanLounge";
import { useVoiceNotebook } from "../useVoiceNotebook";

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
  vi.unstubAllGlobals();
  resetRingStateCache();
});

/** The person's ring read (GET /v2/user/rings), answering these features on. */
async function ringsOn(features: string[]) {
  resetRingStateCache();
  bffFetch.mockImplementationOnce(async () => ({ kind: "response", ok: true, body: { ring: 5, features_on: features } }));
  await loadRingState();
}

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

/** A mic that records whatever the test says. */
class FakeRecorder {
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  static isTypeSupported = () => true;
  start() {
    this.state = "recording";
    this.ondataavailable?.({ data: new Blob(["voice"], { type: "audio/webm" }) });
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => this.onstop?.());
  }
}

/** The backend as the Lounge meets it: the plan as it stands, and every
 *  answer posted. */
function backend(plan: () => Plan) {
  bffFetch.mockImplementation(async (url: string) => ({
    kind: "response",
    ok: true,
    body: url.startsWith("/api/v2/plan")
      ? { enabled: true, wrote: false, plan: plan() }
      : url.startsWith("/api/v2/notebook/state")
        ? { enabled: true, consented: false, max_seconds: 300 }
        : { slots: [] },
  }));
}

const posted = (path: string) =>
  bffFetch.mock.calls.filter(([url, init]) => url === path && (init as { method?: string } | undefined)?.method === "POST");

/** The Lounge as it wires the plan: the thread's end, the plan's footer, and
 *  the bar (the stack, then its one black button) with the plan's say over
 *  it (backend N483). */
function Lounge({
  messages,
  onStartRecording,
  onRecordNext = () => {},
}: {
  messages: LoungeMessage[];
  onStartRecording?: (topic: string | null, start?: unknown) => void;
  onRecordNext?: (arcId: string, takeIndex: number) => void;
}) {
  const reload = async () => {};
  const plan = usePlanLounge({
    signedIn: true,
    thread: { messages, loading: false, reload },
    setThinking: () => {},
    onStartRecording,
    recordHeld: false,
  });
  return (
    <>
      <div data-thread="">{plan.asks}</div>
      {plan.dock}
      <form data-bar="" className={plan.composerDisplay("flex")}>
        <button type="button" aria-label="Your projects" />
        <WillBarMiddle hear={plan.hear} review={null} next={plan.one} held={false} onRecord={onRecordNext} onFirst={plan.startFirst ?? (() => {})} />
      </form>
    </>
  );
}

/** The Lounge opened afresh: it reads the plan as it now stands. */
async function showLounge(
  messages: LoungeMessage[] = [],
  onStartRecording?: (topic: string | null, start?: unknown) => void,
  onRecordNext?: (arcId: string, takeIndex: number) => void,
) {
  act(() => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(<Lounge messages={messages} onStartRecording={onStartRecording} onRecordNext={onRecordNext} />));
  await act(async () => {});
}

const bar = () => host.querySelector("[data-bar]") as HTMLFormElement;
/** The bar's one black button, its words. */
const middle = () => bar().querySelector("button:not([aria-label='Your projects'])")?.textContent;
const taps = (scope: ParentNode = host) => [...scope.querySelectorAll("[data-thread] button")].map((b) => b.textContent);
const tapOn = async (label: string) => {
  const button = [...host.querySelectorAll("[data-thread] button")].find((b) => b.textContent === label) as HTMLButtonElement;
  await act(async () => button.click());
  await act(async () => {});
};

it("a choice is taps in the thread, and the bar keeps its one button", async () => {
  let now: Plan = PLAN;
  backend(() => now);
  await showLounge();
  // The deadline: Will's tap answers, on the right of the thread.
  expect(taps()).toEqual(["Pick a date", "No date yet"]);
  expect(host.querySelector("[data-thread] [data-plan-ask='deadline']")).not.toBeNull();
  // The bar stays under it: the stack and its one black button; no box to
  // type in (N319 item 3, N483 item 2).
  expect(bar().className).not.toContain("hidden");
  expect(host.querySelector("[aria-label='Your projects']")).not.toBeNull();
  expect(middle()).toBe("Start your first recording");
  expect(host.querySelector("textarea")).toBeNull();
  await tapOn("No date yet");
  expect(posted("/api/v2/plan/deadline")[0][1]).toMatchObject({ json: { date: null } });

  // The plan's own yes: "Not now" a grey word, "Yes, ask me" the answer
  // (backend N467 item 4).
  now = { ...PLAN, step: "consent" };
  await showLounge([row({}, "a"), row({}, "b")]);
  expect(taps()).toEqual(["Not now", "Yes, ask me"]);
  const [notNow, yes] = [...host.querySelectorAll("[data-thread] button")];
  expect(notNow.hasAttribute("data-quiet")).toBe(true);
  expect(yes.hasAttribute("data-quiet")).toBe(false);
  await tapOn("Yes, ask me");
  expect(posted("/api/v2/plan/consent/answer")[0][1]).toMatchObject({ json: { yes: true } });

  // A new project's question, after a Take: the same taps, the same bar.
  now = { ...PLAN, status: "active", step: "same_event", first_take_done: true };
  await showLounge([row({}, "c")]);
  // "Yes" last, so the filled answer is the likely one (backend N467 item 7).
  expect(taps()).toEqual(["No", "Yes"]);
  expect(host.querySelector("[data-thread] [data-goes]")?.textContent).toBe("Yes");
  expect(bar().className).not.toContain("hidden");
  await tapOn("No");
  expect(posted("/api/v2/plan/same-event")[0][1]).toMatchObject({ json: { yes: false } });

  // Nothing asked: no taps.
  now = { ...PLAN, status: "active", step: "done", first_take_done: true };
  await showLounge([row({}, "d")]);
  expect(taps()).toEqual([]);
  expect(bar().className).not.toContain("hidden");
});

/** The one recording bar: the trash on the left, then the strip with Stop
 *  inside it, no send (backend N314). */
function oneBar() {
  const recording = host.querySelector("[data-plan-voice-recording] [data-recording-bar]");
  expect(recording).not.toBeNull();
  const trash = recording!.querySelector('button[aria-label="Delete"]') as HTMLButtonElement;
  const strip = recording!.querySelector("[data-walk-recording-strip]")!;
  const stop = strip.querySelector('button[aria-label="Stop"]') as HTMLButtonElement;
  expect(stop?.textContent).toBe("Stop");
  expect(trash.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(host.querySelector('button[aria-label="Send"]')).toBeNull();
  return { trash, stop };
}

it("a spoken question: Record your answer records it, Not now leaves it", async () => {
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
    configurable: true,
  });
  // The answer plays from the phone while it is heard (N275).
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:answer"), revokeObjectURL: vi.fn() });
  try {
    const why = row({ plan_ask: "voice" }, "Please tell me, why does it matter and what is it about?");
    backend(() => ({ ...PLAN, step: "why" }));
    await showLounge([why]);
    // The bar's middle is "Record your answer", with the red dot; "Not now"
    // under the question, a grey word; no box, no mic.
    expect(bar().className).not.toContain("hidden");
    const hear = () => host.querySelector("[data-will-hear]") as HTMLButtonElement | null;
    expect(hear()?.textContent).toBe("Record your answer");
    expect(hear()?.querySelector(".bg-red-500")).not.toBeNull();
    expect(taps()).toEqual(["Not now"]);
    expect(host.querySelector("[data-plan-not-now] [data-quiet]")).not.toBeNull();
    expect(host.querySelector("textarea")).toBeNull();
    expect(host.querySelector("[data-testid='voice-note-mic']")).toBeNull();

    // A tap records with the one bar, in the bar's place.
    const record = async () => {
      await act(async () => hear()!.click());
      await act(async () => new Promise((done) => setTimeout(done, 0)));
    };
    await record();
    expect(bar().className).toContain("hidden");
    // The trash throws it away: nothing is sent, the bar comes back.
    await act(async () => oneBar().trash.click());
    await act(async () => new Promise((done) => setTimeout(done, 0)));
    expect(posted("/api/v2/plan/answer")).toHaveLength(0);
    expect(bar().className).not.toContain("hidden");
    // Stop sends it through the plan's answer path.
    await record();
    await act(async () => oneBar().stop.click());
    await act(async () => new Promise((done) => setTimeout(done, 0)));
    const sent = posted("/api/v2/plan/answer");
    expect(sent).toHaveLength(1);
    expect((sent[0][1] as { body: FormData }).body.get("audio")).toBeInstanceOf(Blob);

    // "Not now" leaves it: the middle is the record button again, until the
    // chat is opened again.
    await showLounge([why]);
    await tapOn("Not now");
    expect(hear()).toBeNull();
    expect(taps()).toEqual([]);
    expect(middle()).toBe("Start your first recording");
    await showLounge([why]);
    expect(hear()?.textContent).toBe("Record your answer");
  } finally {
    vi.unstubAllGlobals();
  }
});

it("a rating is sent once and never written back", async () => {
  backend(() => ({ ...PLAN, step: "stress" }));
  await showLounge([row({ plan_ask: "scale" }, "How stressed do you feel about it right now?")]);
  // The scale keeps its shape, in the thread under the question.
  const scale = host.querySelector("[data-thread] [data-plan-ask='stress']")!;
  expect(scale.textContent).toContain("Calm");
  expect(scale.textContent).toContain("Very stressed");
  expect(bar().className).not.toContain("hidden");
  const seven = scale.querySelector("[aria-label='7 of 10']") as HTMLButtonElement;
  act(() => seven.click());
  act(() => seven.click());
  await act(async () => {});
  const sent = posted("/api/v2/plan/rating");
  expect(sent).toHaveLength(1);
  expect(sent[0][1]).toMatchObject({ json: { value: 7 } });
});

it("the plan's questions never cover Start your first recording", async () => {
  let now: Plan = { ...PLAN, step: "followup" };
  backend(() => now);
  const start = vi.fn();
  // While the questions are asked, and after the plan card: the bar's
  // middle, beside the stack (N483 item 2).
  for (const step of ["deadline", "why", "followup", "consent", "stress"] as const) {
    now = { ...PLAN, step };
    await showLounge([row({}, step)], start);
    expect(step === "why" || step === "followup" ? host.querySelector("[data-will-hear]") : host.querySelector("[data-start-first]")).not.toBeNull();
  }
  now = { ...PLAN, status: "active", step: "done" };
  await showLounge([row({ plan_card: true })], start);
  const button = host.querySelector("[data-start-first]") as HTMLButtonElement;
  expect(button.textContent).toBe("Start your first recording");
  expect(bar().className).not.toContain("hidden");
  expect(host.querySelector("[aria-label='Your projects']")).not.toBeNull();
  expect(taps()).toEqual([]);
  await act(async () => button.click());
  expect(start).toHaveBeenCalledWith("Our Q3 board pitch");

  // A Take recorded first: its walk comes before the questions do (N262).
  now = { ...PLAN, step: "followup", waiting: true };
  await showLounge([row({}, "e")], start);
  expect(host.querySelector("[data-will-hear]")).toBeNull();
  expect(taps()).toEqual([]);
});

it("a first-Take plan: the bar's button at once, and it starts the five slides", async () => {
  const slides = [
    { kicker: "Your field", title: "What do you know better than most people you meet?", body: "The thing people come to you for." },
    { kicker: "Worth sharing", title: "What could you teach someone in five minutes that would save them a year?", body: "Something you learned the hard way." },
  ];
  backend(() => ({ ...PLAN, status: "asking", step: "deadline", first_take: true, first_take_slides: slides }));
  const start = vi.fn();
  await showLounge([row({}, "Your first Take is a short introduction: five questions, one slide each. Answer out loud, as you'd explain it to a friend. At the end, you'll get a few words on how you came across.")], start);
  const button = host.querySelector("[data-start-first]") as HTMLButtonElement;
  expect(button.textContent).toBe("Start your first recording");
  expect(taps()).toEqual([]); // no deadline asked in the chat
  expect(bar().className).not.toContain("hidden");
  await act(async () => button.click());
  expect(start).toHaveBeenCalledWith("Our Q3 board pitch", { firstTake: slides });
});

function ctx(plan: Plan | null = PLAN): PlanRowCtx {
  return { plan, onSeePlan: vi.fn(), onChangePlan: vi.fn(), onBook: vi.fn() };
}

it("the plan's rows are drawn as the prototype draws them", async () => {
  await ringsOn(["plan"]);
  const plain = row({}, "When is your deadline?");
  expect(planRowFor(plain, ctx())).toBeNull();
  expect(planRowFor(row({ plan_card: true }), undefined)).toBeNull();

  act(() => root.render(<>{planRowFor(row({ plan_voice: "answer-1", duration_ms: 64000 }, "said", "user"), ctx())}</>));
  expect(host.querySelector("[data-plan-voice]")).not.toBeNull();
  expect(host.textContent).toContain("1:04");
  // The words Will heard, under the voice (N275).
  expect(host.querySelector("[data-plan-voice-words]")?.textContent).toBe("said");

  // A rating tap, said back as the speaker's turn: a lock and "Answered",
  // never the number (N178, N339).
  act(() => root.render(<>{planRowFor(row({ plan_answered: "rating" }, "Answered", "user"), ctx())}</>));
  const answered = host.querySelector("[data-plan-answered]")!;
  expect(answered.textContent).toBe("Answered");

  const c = ctx({ ...PLAN, status: "active", step: "done", done: 1 });
  act(() => root.render(<>{planRowFor(row({ plan_card: true }), c)}</>));
  const card = host.querySelector("[data-plan-card]")!;
  // The plan only (N319 item 6): no level, no key line, no "How you said
  // it", no "Why this line?", no call (N315).
  expect(card.textContent).toBe("Plan15 minutes, 3 times a week: Mon, Wed, FriYour deadline: Sat 14 NovChange your plan");
  const parts = [...card.querySelectorAll("[data-plan-bar] i")];
  expect(parts.length).toBe(9); // one part per practice, filled with what was done
  expect(parts.filter((i) => i.className.includes("FF640A")).length).toBe(1);
  const change = [...card.querySelectorAll("button")].find((b) => b.textContent === "Change your plan")!;
  act(() => change.click());
  expect(c.onChangePlan).toHaveBeenCalledTimes(1);

  // "See your plan": the same card, with this week's level above it.
  act(() => root.render(<SeePlanSheet plan={c.plan!} onClose={() => {}} onBook={() => {}} onChange={() => {}} />));
  const seen = document.querySelector("[data-plan-card]")!;
  expect(seen.textContent).toBe(
    "This week's levelLet your key line landPlan15 minutes, 3 times a week: Mon, Wed, FriYour deadline: Sat 14 NovChange your plan",
  );

  act(() => root.render(<>{planRowFor(row({ plan_progress: true, done: 1, total: 9 }, "1 of 9 practices done."), c)}</>));
  const progress = host.querySelector("[data-plan-progress]")!;
  expect(progress.querySelector("[data-plan-bar]")).not.toBeNull();
  expect(progress.textContent).toBe("1 of 9 practices done.");
});

it("the plan's calls show only with their ring row", async () => {
  const c = ctx({ ...PLAN, status: "ending", step: "whats_next" });
  await ringsOn(["plan"]);
  act(() => root.render(<>{planRowFor(row({ plan_summary_call: true }), c)}</>));
  expect(host.textContent).toBe(""); // a row written while the calls were on draws nothing
  act(() => root.render(<>{planRowFor(row({ plan_card: true }), c)}</>));
  expect(host.querySelector("[data-plan-book]")).toBeNull();
  expect(host.textContent).not.toContain("call with your coach");

  await ringsOn(["plan", "plan_calls"]);
  act(() => root.render(<></>));
  act(() => root.render(<>{planRowFor(row({ plan_card: true }), c)}</>));
  const card = host.querySelector("[data-plan-card]")!;
  expect(card.textContent).toContain("Kickoff call with your coach: Book");
  expect(card.textContent).toContain("Summary call with your coach: Book");
  const books = card.querySelectorAll("[data-plan-book]");
  expect(books.length).toBe(2);
  act(() => (books[0] as HTMLButtonElement).click());
  expect(c.onBook).toHaveBeenCalledWith("kickoff");
  act(() => root.render(<>{planRowFor(row({ plan_summary_call: true }), c)}</>));
  expect(host.textContent).toContain("Your summary call");
});

it("a practice day's Record Take N is the bar's middle", async () => {
  const closing = { ...row({}), metadata: { next_take: true, arc_id: "arc-1", take_index: 1 } };
  const one = row({ plan_one: true, arc_id: "arc-1", take_index: 1 }, "Today, one thing: say your key line a little slower than the rest. You've got this 💪");
  const recorded = { ...row({ arc_id: "arc-2", take_index: 1 }), kind: "recording_summary" as const };

  // The bubble keeps its words and the key line, and carries no button
  // (N294 item 7).
  const practiceDay: Plan = { ...PLAN, status: "active", step: "done", first_take_done: true };
  act(() => root.render(<>{planRowFor(one, ctx(practiceDay))}</>));
  expect(host.textContent).toContain("Today, one thing: say your key line a little slower than the rest.");
  expect(host.textContent).toContain(PLAN.key_line);
  expect(host.textContent).not.toContain("Record Take");

  // While it is the newest: "Record Take 2", the bar's black button with the
  // red dot, beside the stack, no ✕ (N483). A tap starts that Take.
  backend(() => practiceDay);
  const record = vi.fn();
  await showLounge([closing, one], undefined, record);
  const button = host.querySelector("[data-record-next]") as HTMLButtonElement;
  expect(button.textContent).toBe("Record Take 2");
  expect(bar().className).not.toContain("hidden");
  expect(host.querySelector("[aria-label='Your projects']")).not.toBeNull();
  expect(host.querySelector("[aria-label='Close']")).toBeNull();
  await act(async () => button.click());
  expect(record).toHaveBeenCalledWith("arc-1", 1);

  // A newer Take's closing message takes the button back (N167), and once a
  // newer Take is in, the practice day's button goes.
  await showLounge([one, closing], undefined, record);
  expect(host.querySelector("[data-record-next]")).toBeNull();
  await showLounge([closing, one, recorded], undefined, record);
  expect(host.querySelector("[data-record-next]")).toBeNull();
  expect(bar().className).not.toContain("hidden");
});

it("the feelings before a Take", () => {
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
  const a = actions();
  act(() => root.render(<PlanAsk plan={waiting} busy={false} booking={null} actions={a} onBookNow={vi.fn()} />));
  const [notNow, yes] = [...host.querySelectorAll("button")];
  act(() => (yes as HTMLButtonElement).click());
  act(() => (notNow as HTMLButtonElement).click());
  expect(a.consent).toHaveBeenNthCalledWith(1, true);
  expect(a.consent).toHaveBeenNthCalledWith(2, false);

  const ask = "Some of my questions are personal: how stressed and ready you feel, what worries you, how you feel before each Take.";
  act(() => root.render(<>{planRowFor(row({ plan_ask: "consent" }, ask), ctx(waiting))}</>));
  expect(host.querySelector("[data-bubble]")?.textContent).toContain(ask);
  expect([...host.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Read more"]);
});

it("nothing of the principles before my first Take", async () => {
  let firstTakeDone = false;
  bffFetch.mockImplementation(async (url: string) => ({
    kind: "response",
    ok: true,
    body: url.startsWith("/api/v2/plan")
      ? { enabled: true, wrote: false, plan: { ...PLAN, status: "active", step: "done", first_take_done: firstTakeDone, onboarding: !firstTakeDone } }
      : url.startsWith("/api/v2/notebook/state")
        ? { enabled: true, consented: true, max_seconds: 300 }
        : { slots: [] },
  }));
  const openOffer = vi.fn();
  const reload = async () => {};
  function Lounge({ messages }: { messages: LoungeMessage[] }) {
    const plan = usePlanLounge({ signedIn: true, thread: { messages, loading: false, reload }, setThinking: () => {}, recordHeld: false });
    useVoiceNotebook({ signedIn: true, threadLoading: false, held: plan.holdsPrinciples, drawn: messages, openOffer, reload });
    return null;
  }
  const show = async (messages: LoungeMessage[]) => {
    await act(async () => root.render(<Lounge messages={messages} />));
    await act(async () => {});
  };
  const msg = (client_id: string, metadata: Record<string, unknown>): LoungeMessage =>
    ({ client_id, role: "bot", kind: "text", body: "", metadata, client_created_at: "2026-10-28T10:00:00Z" });
  const ask = msg("ask", { offer: "sunday_note" });
  const take = msg("take-1", { arc_id: "arc-1", take_index: 1 });

  await show([ask]); // the plan card, before my first Take
  expect(openOffer).not.toHaveBeenCalled();

  firstTakeDone = true;
  await show([take, ask]); // my first Take lands
  expect(openOffer).toHaveBeenCalledWith("sunday_note");
});
