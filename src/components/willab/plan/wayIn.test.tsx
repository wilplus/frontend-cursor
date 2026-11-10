// @vitest-environment jsdom
/*
 * STORY    As a newcomer in Artur's chat, while my first Take is processed, I
 *          want Will to check what he heard and ask what I'd like to do here,
 *          so that my plan and my next step are mine before the walk ends.
 * OUTCOME
 *   W1  While Take 1 is processed its wait is a thin row on top of Will's
 *       chat, "Processing your recording", in place of the full wait; the
 *       app asks the way in (POST /api/v2/plan/way-in, chat "artur") and
 *       reads the thread when it wrote; the row turns orange, "Your
 *       feedback is ready.", and a tap opens the walk; nothing waits for
 *       the beats (FT-05; N453 items 1 and 7).
 *   W2  "Here's how others will see you:" is a card: the name from sign-up,
 *       the role, About, "Ask about {topic}"; "That's right" and "Change
 *       it" go to the backend, which keeps it; "Tell me what to change." is
 *       answered out loud, "Record your answer" in the bar's middle (FT-06;
 *       N453 item 2).
 *   W3  "What would you like to do here first?": "Something else" first,
 *       "Learn from others", "Share what I know", "Prepare a talk"; several,
 *       then "Send" in the bar's middle; "Something else" opens the typing
 *       box and its words go with the picks (WID-04; N573).
 *   W4  "When is it?" with "Pick a date" and "No date yet"; the plan's own
 *       "When is your deadline?" is not asked while the way in runs (FT-10,
 *       PLAN-16; N564 item 1).
 *   W5  The questions for people who join are their own rows; the
 *       agreement "Do you accept it?" with "I agree"; one "You're set." with
 *       "Copy my link ›" and "Your questions for people who join ›" (FT-11,
 *       FT-12, FT-13; N572).
 *   W6  After "You're set.": "Your feedback is almost ready. It will appear
 *       at the top of this chat." as Will's bubble; "Your feedback is
 *       ready." with "Open your feedback ›"; after the walk one bubble by
 *       the choice ("Next, ask someone who knows. Tap + to start."), and
 *       "Tell me what you'd like to do, and I'll show you where." waits for
 *       typed words, with the first choice's other answers as taps, one of
 *       which answers it (WAYIN-N601-1; backend N601); "Record Take 2"
 *       stays faded until the walk is done (FT-14, FT-15,
 *       WAYIN-N592-1..4; N592).
 *   W7  The way in is the speaking chat's: every call names it (WAYIN-N590-1;
 *       N590).
 *   W8  A newcomer who came by the link of someone at a business is offered
 *       that business's community once, after "Here's how others will see
 *       you:" and before the first choice's taps: "{inviter} is in {name}'s
 *       community on WillpowerLab. Join it, so people there can answer your
 *       Takes?" with "Join" and "Not now"; either answer is sent once and
 *       the choice comes back; with no offer, or a 404, no bubble. Its words
 *       are drafted, so it stays off until the founder signs them (MATCH-06;
 *       N559 item 1, Never 4).
 *   W9  After the walk, a sharer's bubble ("Next, set up your assistant,
 *       ...") carries "Set up my chat ›", the setup's own words, which
 *       begins the setup of their own chat in Will's chat; without the chat
 *       builder's ring, no link (WAYIN-N578-4; backend
 *       `way_in._after_walk_row` opens "setup_chat", N578 item 4).
 *   W10 While the way in waits and nothing new comes (a Take with no
 *       words), the app asks less and less often, never more than once a
 *       minute, and stops after a long quiet instead of asking forever
 *       (WAYIN-POLL-1).
 * PROVES   each test's name begins with the story it proves.
 * WHY      backend PR #1854 (`services/way_in.py`, POST /v2/plan/way-in);
 *          N453, N564, N572, N573, N590, N592; docs/flows/the-plan.md §2.
 *          W8: N559 item 1 (founder, 9 November 2026), backend PR #1862.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { Plan, WayInView } from "@/services/api/plan";
import { WillBarMiddle, dockFor } from "./PlanDock";
import { planRowFor, type PlanRowCtx } from "./PlanRows";
import { usePlanLounge } from "./usePlanLounge";
import { WayInTop } from "./WayIn";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Reply = { kind: string; ok: boolean; body: unknown };
const bffFetch = vi.hoisted(() => vi.fn(async (_url: string, _init?: unknown): Promise<Reply> => ({ kind: "response", ok: true, body: {} })));
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch }));
// The community offer's words wait for the founder (Never 4): off as
// shipped; a test turns it on to prove the beat.
const words = vi.hoisted(() => ({ signed: false }));
vi.mock("@/lib/willab/wayIn", async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    get COMMUNITY_OFFER_SIGNED() {
      return words.signed;
    },
  };
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  bffFetch.mockReset();
  words.signed = false;
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const VIEW: WayInView = {
  asking: null,
  done: [],
  chosen: null,
  talk_date: null,
  walk_ready: false,
  walk_done: false,
  record_next: false,
};

function planWith(way: Partial<WayInView> | null, extra: Partial<Plan> = {}): Plan {
  return {
    id: "plan-1",
    status: "asking",
    step: "deadline",
    deadline: null,
    deadline_short: null,
    deadline_day: null,
    total: 0,
    done: 1,
    level: null,
    level_name: null,
    pace_week: false,
    key_line: null,
    why_line: null,
    key_answer_id: null,
    calls: { kickoff: null, summary: null },
    first_take_done: true,
    topic: null,
    waiting: true,
    first_take: true,
    way_in: way ? { ...VIEW, ...way } : null,
    ...extra,
  };
}

let n = 0;
function will(body: string, meta: Record<string, unknown>): LoungeMessage {
  n += 1;
  return { client_id: `w${n}`, role: "bot", kind: "text", body, metadata: { plan: "plan-1", ...meta }, client_created_at: "2026-11-09T10:00:00Z" };
}

/** The backend as the app meets it: GET the plan, POST the way in. */
function backend(plan: Plan, wrote: unknown[] = []) {
  bffFetch.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/v2/plan/way-in")) return { kind: "response", ok: true, body: { plan, messages: wrote } };
    return { kind: "response", ok: true, body: { enabled: true, plan } };
  });
}

const posts = () =>
  bffFetch.mock.calls
    .filter(([url]) => String(url).startsWith("/api/v2/plan/way-in"))
    .map(([url, init]) => ({ url: String(url), init: init as { json?: Record<string, unknown>; body?: FormData } }));

const onWords = vi.fn();
const onOpenFeedback = vi.fn();
const onJoinQuestions = vi.fn();
const onSetUpChat = vi.fn();
let setUpChatOn = true;
const reload = vi.fn(async () => {});

/** Will's chat, as much of it as the way in touches: the thread's answers,
 *  the bar's middle (or the way in's "Send"), the words box's say. */
function Chat({ messages, inFlight = false }: { messages: LoungeMessage[]; inFlight?: boolean }) {
  const plan = usePlanLounge({
    signedIn: true,
    thread: { messages, loading: false, reload },
    setThinking: () => {},
    recordHeld: inFlight,
    onOpenFeedback,
    onJoinQuestions,
    onSetUpChat: setUpChatOn ? onSetUpChat : undefined,
    onWords,
  });
  sayRef.current = plan.say;
  wordsWaitRef.current = plan.wordsWait;
  return (
    <>
      <div data-thread="">
        {messages.map((m) => (
          <div key={m.client_id}>{planRowFor(m, plan.rows) ?? <div data-plain="">{m.body}</div>}</div>
        ))}
        {plan.asks}
      </div>
      {plan.dock}
      <form data-bar="">
        {plan.barMiddle ?? (
          <WillBarMiddle
            hear={plan.hear}
            next={{ arcId: "arc-1", takeIndex: 1 }}
            held={plan.recordWaits}
            onRecord={() => {}}
            onFirst={() => {}}
          />
        )}
      </form>
    </>
  );
}
const sayRef: { current: ((words: string) => boolean) | null } = { current: null };
const wordsWaitRef = { current: false };

async function show(plan: Plan, messages: LoungeMessage[], inFlight = false, wrote: unknown[] = []) {
  backend(plan, wrote);
  // The chat opened afresh: it reads the plan as it now stands.
  act(() => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(<Chat messages={messages} inFlight={inFlight} />));
  await act(async () => {});
  await act(async () => {});
}

const thread = () => host.querySelector("[data-thread]") as HTMLElement;
const bar = () => host.querySelector("[data-bar]") as HTMLElement;
const buttons = (scope: ParentNode) => [...scope.querySelectorAll("button")];
const labels = (scope: ParentNode) => buttons(scope).map((b) => b.textContent);
async function tap(scope: ParentNode, label: string) {
  const button = buttons(scope).find((b) => b.textContent?.startsWith(label)) as HTMLButtonElement;
  expect(button, label).toBeTruthy();
  await act(async () => button.click());
  await act(async () => {});
}
const lastAnswer = () => posts().at(-1)?.init.json?.answer;

// ── FT-05 ──────────────────────────────────────────────────────────────────

it("FT-05: the processing labels sit in a thin row at the top of Will's chat instead of the processing screen", async () => {
  await act(async () =>
    root.render(<WayInTop on resume={{ status: "analyzing" }} readyArc={null} walkReady={false} label="Processing your recording" onOpen={() => {}} />),
  );
  const row = host.querySelector("[data-way-in-processing]") as HTMLElement;
  expect(row.dataset.wayInProcessing).toBe("processing");
  expect(row.textContent).toBe("Processing your recording");
  // Any other Take keeps its own wait.
  await act(async () =>
    root.render(<WayInTop on={false} resume={{ status: "analyzing" }} readyArc={null} walkReady={false} label="Processing your recording" onOpen={() => {}} />),
  );
  expect(host.querySelector("[data-way-in-processing]")).toBeNull();
});

it("FT-05: Will says \"While your feedback is being prepared, check what I heard.\", then one beat at a time, asked of the backend while Take 1 is processed", async () => {
  const opener = { client_id: "o", role: "bot", body: "While your feedback is being prepared, check what I heard.", metadata: { plan: "plan-1", way_in: "opener" } };
  await show(planWith(null), [], true, [opener]);
  expect(posts()[0].url).toBe("/api/v2/plan/way-in");
  expect(posts()[0].init.json?.chat).toBe("artur");
  expect(reload).toHaveBeenCalled(); // the rows it wrote are read
  // The opener is Will's own bubble, drawn as any other.
  const row = will("While your feedback is being prepared, check what I heard.", { way_in: "opener" });
  await show(planWith({ asking: null, done: ["opener"] }), [row]);
  expect(host.querySelector("[data-plain]")?.textContent).toBe("While your feedback is being prepared, check what I heard.");
});

it("FT-05: the walk's row turns orange when the walk is ready; nothing waits for the checks", async () => {
  const open = vi.fn();
  await act(async () => root.render(<WayInTop on resume={null} readyArc={null} walkReady label="Processing your recording" onOpen={open} />));
  const row = host.querySelector("[data-way-in-processing]") as HTMLButtonElement;
  expect(row.dataset.wayInProcessing).toBe("ready");
  expect(row.textContent).toContain("Your feedback is ready.");
  await act(async () => row.click());
  expect(open).toHaveBeenCalledOnce();
});

// ── FT-06 ──────────────────────────────────────────────────────────────────

const CARD = will("", {
  way_in: "profile",
  way_in_profile: { name: "Anna", role: "Reporter on the politics desk", about: "I read bills for a living.", topics: ["Ask about reading bills", "Ask about politics"] },
  chips: ["That's right", "Change it"],
});

it("FT-06: the role, one line of About, up to three topics as \"Ask about {topic}\"; the name from sign-up", async () => {
  await show(planWith({ asking: "profile" }), [will("Here's how others will see you:", { way_in: "profile" }), CARD]);
  const card = host.querySelector("[data-way-in-profile]") as HTMLElement;
  expect(card.textContent).toContain("Anna");
  expect(card.textContent).toContain("Reporter on the politics desk");
  expect(card.textContent).toContain("I read bills for a living.");
  expect(card.textContent).toContain("Ask about reading bills");
  expect(card.textContent).toContain("Ask about politics");
  expect(host.querySelector("[data-plain]")?.textContent).toBe("Here's how others will see you:");
});

it("FT-06: \"That's right\" keeps it; \"Change it\" brings \"Tell me what to change.\", answered out loud", async () => {
  await show(planWith({ asking: "profile" }), [CARD]);
  expect(labels(host.querySelector("[data-way-in-ask]") as HTMLElement)).toEqual(["That's right", "Change it"]);
  await tap(thread(), "That's right");
  expect(lastAnswer()).toEqual({ beat: "profile", picked: "That's right" });

  await show(planWith({ asking: "profile" }), [CARD]);
  await tap(thread(), "Change it");
  expect(lastAnswer()).toEqual({ beat: "profile", picked: "Change it" });

  // "Tell me what to change.": no taps; the bar's middle records the answer.
  const what = will("Tell me what to change.", { way_in: "profile", plan_ask: "way_in_voice" });
  await show(planWith({ asking: "profile" }), [CARD, will("Change it", { way_in: "profile" }), what]);
  expect(host.querySelector("[data-way-in-ask]")).toBeNull();
  expect(bar().textContent).toBe("Record your answer");
});

it("FT-06: others see the card only after \"That's right\": the app keeps nothing itself, the tap goes to the backend", async () => {
  await show(planWith({ asking: "profile" }), [CARD]);
  await tap(thread(), "That's right");
  expect(posts().at(-1)?.init.json).toMatchObject({ chat: "artur", answer: { beat: "profile", picked: "That's right" } });
});

// ── WID-04 ─────────────────────────────────────────────────────────────────

const CHOICE = will("What would you like to do here first?", {
  way_in: "choice",
  chips: ["Something else", "Learn from others", "Share what I know", "Prepare a talk"],
  multi: true,
  send: "Send",
  types: "Something else",
});

it("WID-04: \"What would you like to do here first?\" with \"Something else\" (first, it opens the typing box), \"Learn from others\", \"Share what I know\" and \"Prepare a talk\"", async () => {
  await show(planWith({ asking: "choice" }), [CHOICE]);
  const picks = host.querySelector("[data-way-in-choice]") as HTMLElement;
  expect(labels(picks)).toEqual(["Something else", "Learn from others", "Share what I know", "Prepare a talk"]);
  await tap(picks, "Something else");
  expect(onWords).toHaveBeenCalled();
  expect(wordsWaitRef.current).toBe(true);
  expect(sayRef.current?.("Find a mentor")).toBe(true);
  await act(async () => {});
  expect(lastAnswer()).toEqual({ beat: "choice", picked: ["Something else"], said: "Find a mentor" });
});

it("WID-04: several may be tapped, then \"Send\" in the bar's middle; each answer opens its own branch", async () => {
  await show(planWith({ asking: "choice" }), [CHOICE]);
  expect(bar().textContent).not.toBe("Send");
  const picks = host.querySelector("[data-way-in-choice]") as HTMLElement;
  await tap(picks, "Prepare a talk");
  await tap(picks, "Share what I know");
  expect(bar().textContent).toBe("Send");
  await tap(bar(), "Send");
  expect(lastAnswer()).toEqual({ beat: "choice", picked: ["Prepare a talk", "Share what I know"] });
});

it("WID-04: a coach's link never sees it: the app asks the speaking chat's way in, and the backend decides the branches", async () => {
  await show(planWith({ asking: "choice" }), [CHOICE]);
  await tap(host.querySelector("[data-way-in-choice]") as HTMLElement, "Learn from others");
  await tap(bar(), "Send");
  expect(posts().every((p) => p.init.json?.chat === "artur")).toBe(true);
  expect(posts().some((p) => "known" in (p.init.json ?? {}))).toBe(false); // the backend's defaults: no team, no coach's link
});

// ── FT-10, PLAN-16 ─────────────────────────────────────────────────────────

const WHEN = will("When is it?", { way_in: "talk_date", chips: ["Pick a date", "No date yet"], plan_ask: "way_in_date" });

it("FT-10: \"When is it?\" once, with \"No date yet\" (or a date)", async () => {
  await show(planWith({ asking: "talk_date" }), [WHEN]);
  expect(labels(host.querySelector("[data-way-in-ask]") as HTMLElement)).toEqual(["Pick a date", "No date yet"]);
  await tap(thread(), "No date yet");
  expect(lastAnswer()).toEqual({ beat: "talk_date", date: null });

  await show(planWith({ asking: "talk_date" }), [WHEN]);
  await tap(thread(), "Pick a date");
  expect(host.querySelector("[role='dialog']")).not.toBeNull(); // the month to pick the day in
});

it("FT-10: with a date the plan card shows it: the card row is the plan's own", async () => {
  const card = will("", { plan_card: true });
  await show(planWith({ asking: null, done: ["talk_date", "plan_card"], talk_date: "2026-12-01" }, { deadline: "2026-12-01", deadline_short: "Tue 1 Dec" }), [card]);
  expect(host.querySelector("[data-plain]")).toBeNull(); // drawn as the plan card, not a bubble
});

it("PLAN-16: anyone else is never asked a date; \"When is your deadline?\" is not asked", async () => {
  // The plan's own deadline step stands down while the way in runs.
  expect(dockFor(planWith({ asking: "choice" }, { waiting: false, first_take: false, step: "deadline" }), null)).toBeNull();
  await show(planWith({ asking: "choice", chosen: null }, { waiting: false, first_take: false, step: "deadline" }), [CHOICE]);
  expect(labels(thread())).not.toContain("Pick a date");
  expect(labels(thread())).not.toContain("No date yet");
});

// ── FT-11, FT-12, FT-13 ────────────────────────────────────────────────────

it("FT-11: \"Share what I know\" brings the questions for people who join: their own rows answer them, the way in shows no taps of its own", async () => {
  const intro = { client_id: "js", role: "bot" as const, kind: "text" as const, body: "", metadata: { join_setup: { step: "say" } }, client_created_at: "x" };
  await show(planWith({ asking: "share", chosen: ["Share what I know"] }), [CHOICE, will("Share what I know", { way_in: "choice" }), intro]);
  expect(host.querySelector("[data-way-in-ask]")).toBeNull();
  expect(host.querySelector("[data-way-in-choice]")).toBeNull();
});

it("FT-12: the data processing agreement and \"Do you accept it?\" with \"I agree\"", async () => {
  const agree = will("Do you accept it?", { way_in: "agreement", chips: ["I agree"], agreement: "data_processing" });
  await show(planWith({ asking: "agreement", chosen: ["Share what I know"] }), [agree]);
  expect(host.querySelector("[data-plain]")?.textContent).toBe("Do you accept it?");
  expect(labels(host.querySelector("[data-way-in-ask]") as HTMLElement)).toEqual(["I agree"]);
  await tap(thread(), "I agree");
  expect(lastAnswer()).toEqual({ beat: "agreement", picked: "I agree" });
});

it("FT-12: nobody else is asked it on the way in: no agreement row, no \"I agree\"", async () => {
  await show(planWith({ asking: null, done: ["plan_card", "set"] }), [will("You're set.", { way_in: "set" })]);
  expect(labels(thread())).not.toContain("I agree");
});

it("FT-13: one \"You're set.\"; for sharers also \"Copy my link ›\" and \"Your questions for people who join ›\"", async () => {
  const set = will("You're set.", { way_in: "set", links: ["Copy my link ›", "Your questions for people who join ›"] });
  await show(planWith({ done: ["set"] }), [set]);
  expect(thread().textContent).toContain("You're set.");
  expect(labels(thread())).toEqual(["Copy my link›", "Your questions for people who join›"]);
  await tap(thread(), "Your questions for people who join");
  expect(onJoinQuestions).toHaveBeenCalled();
  // Not a sharer: the bubble alone, as any of Will's.
  await show(planWith({ done: ["set"] }), [will("You're set.", { way_in: "set" })]);
  expect(host.querySelector("[data-plain]")?.textContent).toBe("You're set.");
});

it("FT-13: then the walk: \"Open your feedback ›\" opens it", async () => {
  const ready = will("Your feedback is ready.", { way_in: "next", chips: ["Open your feedback ›"], opens: "feedback" });
  await show(planWith({ done: ["set", "next"], walk_ready: true }), [ready]);
  await tap(thread(), "Open your feedback");
  expect(onOpenFeedback).toHaveBeenCalled();
});

// ── FT-14 ──────────────────────────────────────────────────────────────────

it("FT-14: \"Learn from others\" takes the place \"Ask my team something\" had: after the walk, \"Next, ask someone who knows. Tap + to start.\"", async () => {
  const next = will("Next, ask someone who knows. Tap + to start.", { way_in: "next", way_in_next: ["Learn from others"] });
  await show(planWith({ done: ["set", "next"], walk_done: true, record_next: true, chosen: ["Learn from others"] }), [next]);
  expect(host.querySelector("[data-plain]")?.textContent).toBe("Next, ask someone who knows. Tap + to start.");
});

it("FT-14: where it leads is the backend's line: the app adds no words of its own to it", async () => {
  const next = will("Next, ask someone who knows. Tap + to start.", { way_in: "next", way_in_next: ["Learn from others"] });
  await show(planWith({ done: ["set", "next"], walk_done: true, record_next: true }), [next]);
  expect(thread().textContent).toBe("Next, ask someone who knows. Tap + to start.");
});

// ── WAYIN-N592 ─────────────────────────────────────────────────────────────

it("WAYIN-N592-1: while the feedback is prepared, \"Your feedback is almost ready. It will appear at the top of this chat.\"", async () => {
  const almost = will("Your feedback is almost ready. It will appear at the top of this chat.", { way_in: "next" });
  await show(planWith({ done: ["set", "next"] }), [almost]);
  expect(host.querySelector("[data-plain]")?.textContent).toBe("Your feedback is almost ready. It will appear at the top of this chat.");
  expect(labels(thread())).toEqual([]);
});

it("WAYIN-N592-2: once it is ready, \"Your feedback is ready.\" with \"Open your feedback ›\"", async () => {
  const ready = will("Your feedback is ready.", { way_in: "next", chips: ["Open your feedback ›"], opens: "feedback" });
  await show(planWith({ done: ["set", "next"], walk_ready: true }), [ready]);
  expect(thread().textContent).toContain("Your feedback is ready.");
  expect(labels(thread())).toEqual(["Open your feedback›"]);
});

it("WAYIN-N592-3: after the walk one bubble by the choice; \"Tell me what you'd like to do, and I'll show you where.\" waits for words", async () => {
  const next = will("Next, ask someone who knows. Tap + to start. Tell me what you'd like to do, and I'll show you where.", {
    way_in: "next",
    way_in_next: ["Learn from others", "Something else"],
    way_in_asks: "else",
  });
  await show(planWith({ done: ["set", "next"], walk_done: true, record_next: true }), [next]);
  expect(host.querySelector("[data-plain]")?.textContent).toBe(
    "Next, ask someone who knows. Tap + to start. Tell me what you'd like to do, and I'll show you where.",
  );
  expect(wordsWaitRef.current).toBe(true);
  expect(sayRef.current?.("Maybe a book club")).toBe(true);
  await act(async () => {});
  expect(lastAnswer()).toEqual({ beat: "else", said: "Maybe a book club" });
});

it("WAYIN-N601-1: \"Tell me what you'd like to do, and I'll show you where.\" offers the other choices as taps; one tap answers it", async () => {
  const next = will("Tell me what you'd like to do, and I'll show you where.", {
    way_in: "next",
    way_in_next: ["Something else"],
    way_in_asks: "else",
    chips: ["Prepare a talk", "Share what I know", "Learn from others"],
  });
  await show(planWith({ done: ["set", "next"], walk_done: true, record_next: true }), [next]);
  expect(labels(thread())).toEqual(["Prepare a talk", "Share what I know", "Learn from others"]);
  expect(wordsWaitRef.current).toBe(true);
  await act(async () => {
    (Array.from(thread().querySelectorAll("button")).find((b) => b.textContent === "Prepare a talk") as HTMLButtonElement).click();
  });
  expect(lastAnswer()).toEqual({ beat: "else", picked: "Prepare a talk" });
});

it("WAYIN-N592-4: \"Record Take 2\" stays faded until the walk is done", async () => {
  await show(planWith({ done: ["set", "next"], walk_ready: true }), []);
  const button = () => bar().querySelector("button") as HTMLButtonElement;
  expect(button().textContent).toContain("Record Take 2");
  expect(button().disabled).toBe(true);
  await show(planWith({ done: ["set", "next"], walk_ready: true, walk_done: true, record_next: true }), []);
  expect(button().disabled).toBe(false);
});

// ── WAYIN-N578, WAYIN-POLL ──────────────────────────────────────────────────

it("WAYIN-N578-4: after the walk a sharer's bubble carries \"Set up my chat ›\", which begins the setup of their own chat", async () => {
  const next = will("Next, set up your assistant, so people who join you are met your way.", {
    way_in: "next",
    way_in_next: ["Share what I know"],
    opens: "setup_chat",
  });
  await show(planWith({ done: ["set", "next"], walk_done: true, record_next: true, chosen: ["Share what I know"] }), [next]);
  expect(thread().textContent).toContain("Next, set up your assistant, so people who join you are met your way.");
  expect(labels(thread())).toEqual(["Set up my chat›"]);
  await tap(thread(), "Set up my chat");
  expect(onSetUpChat).toHaveBeenCalledOnce();
  // Without the chat builder's ring the setup cannot begin: no link.
  setUpChatOn = false;
  await show(planWith({ done: ["set", "next"], walk_done: true, record_next: true, chosen: ["Share what I know"] }), [next]);
  expect(labels(thread())).toEqual([]);
  setUpChatOn = true;
});

it("WAYIN-POLL-1: while nothing new comes, the way in is asked less and less often, and then no more", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await show(planWith({ done: ["opener"] }), []);
    expect(posts()).toHaveLength(1);
    const after = async (ms: number) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
      return posts().length;
    };
    expect(await after(5_000)).toBe(2); // a few seconds first
    expect(await after(5_000)).toBe(2); // then half as long again
    expect(await after(2_500)).toBe(3);
    const hour = await after(60 * 60_000);
    expect(hour).toBeLessThan(40); // never more than once a minute once slowed
    expect(await after(3 * 60 * 60_000)).toBe(hour); // and then it stops
  } finally {
    vi.useRealTimers();
  }
});

// ── WAYIN-N590 ─────────────────────────────────────────────────────────────

it("WAYIN-N590-1: the speaking way in is Artur's chat alone: every call, typed or spoken, names the speaking chat", async () => {
  await show(planWith(null), [], true);
  await show(planWith({ asking: "choice" }), [CHOICE]);
  await tap(host.querySelector("[data-way-in-choice]") as HTMLElement, "Prepare a talk");
  await tap(bar(), "Send");
  const { wayInVoice } = await import("@/services/api/plan");
  await wayInVoice(new Blob(["x"], { type: "audio/webm" }), "profile");
  const all = posts();
  expect(all.length).toBeGreaterThan(1);
  for (const { init } of all) {
    expect(init.json ? init.json.chat : init.body?.get("chat")).toBe("artur");
  }
  // A plan with no way in and no Take 1 in flight asks nothing.
  bffFetch.mockClear();
  await show(planWith(null, { first_take: false, waiting: false, status: "active" }), [], true);
  expect(posts()).toEqual([]);
});

// ── MATCH-06 ───────────────────────────────────────────────────────────────

const OFFER = { id: "biz-1", name: "Invita", inviter: "Maya Lindqvist" };

/** The backend with the community offer route (backend #1862). */
function withOffer(plan: Plan, offer: unknown) {
  bffFetch.mockImplementation(async (url: string, init?: unknown) => {
    if (url.startsWith("/api/v2/me/community-offer")) {
      const method = (init as { method?: string } | undefined)?.method;
      if (offer === 404) return { kind: "response", ok: false, body: { error: "NOT_FOUND" } };
      return { kind: "response", ok: true, body: method === "POST" ? { offer: null, joined: true } : { offer } };
    }
    if (url.startsWith("/api/v2/plan/way-in")) return { kind: "response", ok: true, body: { plan, messages: [] } };
    return { kind: "response", ok: true, body: { enabled: true, plan } };
  });
}
async function showOffer(plan: Plan, messages: LoungeMessage[], offer: unknown) {
  act(() => root.unmount());
  root = createRoot(host);
  withOffer(plan, offer);
  await act(async () => root.render(<Chat messages={messages} />));
  await act(async () => {});
  await act(async () => {});
}
const offerPosts = () =>
  bffFetch.mock.calls
    .filter(([url, init]) => String(url).startsWith("/api/v2/me/community-offer") && (init as { method?: string })?.method === "POST")
    .map(([, init]) => (init as { json?: unknown }).json);

it("MATCH-06: after the profile, the business's community is offered once with \"Join\" and \"Not now\"; either answer is sent and the choice comes back", async () => {
  words.signed = true;
  for (const [tapped, answer] of [["Join", "join"], ["Not now", "not_now"]] as const) {
    bffFetch.mockReset();
    await showOffer(planWith({ asking: "choice", done: ["opener", "profile"] }), [CHOICE], OFFER);
    const offer = host.querySelector("[data-community-offer]") as HTMLElement;
    expect(offer.textContent).toBe(
      "Maya Lindqvist is in Invita's community on WillpowerLab. Join it, so people there can answer your Takes?",
    );
    // The first choice waits under it.
    expect(host.querySelector("[data-way-in-choice]")).toBeNull();
    expect(labels(host.querySelector("[data-community-offer-ask]") as HTMLElement)).toEqual(["Join", "Not now"]);
    await tap(thread(), tapped);
    expect(offerPosts()).toEqual([{ id: "biz-1", answer }]);
    expect(host.querySelector("[data-community-offer]")).toBeNull();
    expect(labels(host.querySelector("[data-way-in-choice]") as HTMLElement)).toEqual([
      "Something else", "Learn from others", "Share what I know", "Prepare a talk",
    ]);
  }
  // With no one's name on the link, the ask names the business alone.
  await showOffer(planWith({ asking: "choice", done: ["opener", "profile"] }), [CHOICE], { ...OFFER, inviter: null });
  expect(host.querySelector("[data-community-offer]")?.textContent).toBe(
    "Join Invita's community on WillpowerLab, so people there can answer your Takes?",
  );
});

it("MATCH-06: no offer, a 404, the profile still asked, or the words not yet signed: no bubble", async () => {
  words.signed = true;
  for (const offer of [null, 404]) {
    await showOffer(planWith({ asking: "choice", done: ["opener", "profile"] }), [CHOICE], offer);
    expect(host.querySelector("[data-community-offer]")).toBeNull();
    expect(host.querySelector("[data-way-in-choice]")).not.toBeNull();
  }
  // Before "Here's how others will see you:" has its answer, never.
  await showOffer(planWith({ asking: "profile" }), [CARD], OFFER);
  expect(host.querySelector("[data-community-offer]")).toBeNull();
  // As shipped, until the founder signs its words (Never 4): not even asked.
  words.signed = false;
  bffFetch.mockReset();
  await showOffer(planWith({ asking: "choice", done: ["opener", "profile"] }), [CHOICE], OFFER);
  expect(host.querySelector("[data-community-offer]")).toBeNull();
  expect(bffFetch.mock.calls.some(([url]) => String(url).startsWith("/api/v2/me/community-offer"))).toBe(false);
});
