// @vitest-environment jsdom
/*
STORY    As a coach, I want a speaker's plan in my queue when it needs me, so
         that I pick their level blind, or send my video for a level that
         hasn't moved, and their plan follows my answer.
OUTCOME
  O1  A plan that waits comes first in my queue, on its speaker's card ("New
      plan", "Asked about their level", "Three Takes without moving"), and
      as "Their plan" above their Takes; the Lounge bubble counts it.
  O2  "Which level comes first?" shows their voice message, their key line
      and the five levels, and nothing of the plan's level; my pick brings
      What happened with only what is known; "Keep yours" takes me back to
      my queue, read again.
  O3  A stuck level opens on its name, "Three Takes without moving. Next in
      the row: your video." and Record; "Share with {p}" sends my video as my
      word on their latest Take, keeping the words I sent there, and the
      plan leaves my queue.
PROVES   O1 -> "a waiting plan comes first, on its speaker's card and as Their plan on their page"
         O2 -> "Which level comes first? is blind; the pick brings What happened; Keep yours reads the queue again"
         O3 -> "a stuck level: its name, the line and Record; Share sends the video as the coach's word and answers the plan"
WHY      The coach's side of the plan, built as the founder's prototype draws
         it (backend N213, https://claude.ai/artifact/QznwCAgkBHAVAGDMKVUKvE);
         Never 2: the coach picks before seeing the machine's level.
*/
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchCoachPlan = vi.fn();
const pickPlanLevel = vi.fn();
const markPlanAnswered = vi.fn();
vi.mock("@/services/api/coachPlans", async (orig) => ({
  ...(await orig<typeof import("@/services/api/coachPlans")>()),
  fetchCoachPlan: (...a: unknown[]) => fetchCoachPlan(...a),
  pickPlanLevel: (...a: unknown[]) => pickPlanLevel(...a),
  markPlanAnswered: (...a: unknown[]) => markPlanAnswered(...a),
  markPlanUnclear: vi.fn(async () => true),
}));
const fetchTakeWord = vi.fn();
const saveTakeWord = vi.fn();
vi.mock("@/services/api/coachWalk", async (orig) => ({
  ...(await orig<typeof import("@/services/api/coachWalk")>()),
  fetchTakeWord: (...a: unknown[]) => fetchTakeWord(...a),
  saveTakeWord: (...a: unknown[]) => saveTakeWord(...a),
}));
const uploadCoachVideo = vi.fn();
vi.mock("@/services/api/coachReview", () => ({
  fetchCoachReviewSession: vi.fn(async () => null),
  uploadCoachVideo: (...a: unknown[]) => uploadCoachVideo(...a),
}));
vi.mock("@/services/api/coachPanel", () => ({
  fetchErrorAudit: vi.fn(async () => null),
  fetchBlockPicks: vi.fn(async () => null),
  fetchV4MomentPicks: vi.fn(async () => null),
  fetchV4SurerPairs: vi.fn(async () => null),
}));
vi.mock("../coachwalk/useConfidenceChainReceipt", () => ({
  useConfidenceChainReceipt: () => ({ current: null }),
}));
const CLIP = new File(["v"], "clip.webm", { type: "video/webm" });
vi.mock("@/hooks/useCoachVideoRecorder", () => ({
  useCoachVideoRecorder: () => ({
    state: { status: "stopped", file: CLIP, url: "blob:clip" },
    previewStream: null, start: vi.fn(async () => {}), stop: vi.fn(async () => {}), reset: vi.fn(),
  }),
}));

import CoachPanel from "./CoachPanel";
import { PANEL_START, panelReducer, type PanelAction, type PanelState } from "@/lib/willab/coachPanel";
import { mapMomentsQueue, speakersWaiting, type QueueSpeaker } from "@/lib/willab/coachWalk";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  for (const f of [fetchCoachPlan, pickPlanLevel, markPlanAnswered, fetchTakeWord, saveTakeWord, uploadCoachVideo]) f.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const q = (sel: string) => host.querySelector<HTMLElement>(sel);
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const press = (text: string) => {
  const button = [...host.querySelectorAll<HTMLElement>("button")].filter((b) => b.textContent?.includes(text)).pop();
  if (!button) throw new Error(`no button "${text}" in: ${host.textContent}`);
  act(() => button.click());
};

// The backend's queue, as GET /v2/coach/queue/moments sends it (backend N213).
const QUEUE = mapMomentsQueue([
  { pseudonym: "Swift Lark", goal: "Win next year's budget from the board.", waiting: 0, takes: [],
    plan: { plan_id: "p1", kind: "new", since: "2026-10-27T08:00:00Z", deadline_short: "Sat 14 Nov" } },
  { pseudonym: "Bold Finch", goal: null, waiting: 0, takes: [],
    plan: { plan_id: "p3", kind: "stuck", since: "2026-10-27T08:04:00Z", level_name: "Let your key line land" } },
  { pseudonym: "Quiet Heron", goal: null, waiting: 4, takes: [{ session_id: "t1", take_index: 1, sent_at: "2026-10-27T09:00:00Z",
    waiting: 4, moments: [{ snippet_id: "s1", state: "judge_it" }] }] },
]);

function Host({ speakers, refresh }: { speakers: QueueSpeaker[]; refresh?: () => void }) {
  const [state, setState] = useState<PanelState>(() => panelReducer(PANEL_START, { type: "open" }));
  const dispatch = (a: PanelAction) => setState((s) => panelReducer(s, a));
  return <CoachPanel state={state} dispatch={dispatch} speakers={speakers} loading={false} refresh={refresh} />;
}

describe("the coach's side of the plan", () => {
  it("a waiting plan comes first, on its speaker's card and as Their plan on their page", () => {
    expect(speakersWaiting(QUEUE)).toBe(3);
    act(() => root.render(<Host speakers={[QUEUE[2]!, QUEUE[0]!, QUEUE[1]!]} />));
    const rows = [...host.querySelectorAll<HTMLElement>("[data-testid=coach-panel-speakers] [data-walk-choice]")]
      .map((r) => r.textContent);
    expect(rows).toEqual(["Swift LarkNew plan", "Bold FinchThree Takes without moving", "Quiet Heron4 moments waiting"]);
    press("Swift Lark");
    expect(q("[data-testid=coach-panel-speaker]")!.textContent).toContain(`${COPY.theirPlan}New plan · deadline Sat 14 Nov`);
    act(() => root.render(<Host speakers={[QUEUE[1]!]} />));
    press("Bold Finch");
    expect(host.textContent).toContain("Let your key line land · three Takes without moving");
  });

  it("Which level comes first? is blind; the pick brings What happened; Keep yours reads the queue again", async () => {
    fetchCoachPlan.mockResolvedValue({
      planId: "p1", kind: "new", why: { answerId: "a1", durationMs: 64000 },
      keyLine: { text: "The window closes once the incumbents match our price.", answerId: "a2", durationMs: 6000 },
      levels: [["say_once", "Say it once, and it lands"], ["key_line", "Let your key line land"],
        ["pauses", "Pauses that hold the room"], ["voice_moves", "A voice that moves"], ["make_it_yours", "Make it yours"]]
        .map(([key, name]) => ({ key, name })),
      levelName: null, takeSessionId: null,
    });
    pickPlanLevel.mockResolvedValue({ ok: true, reveal: {
      you: "Let your key line land", machine: "Pauses that hold the room", deadlineShort: "Sat 14 Nov",
      stress: 7, ready: null, keyLine: { text: "The window closes once the incumbents match our price.", answerId: "a2", durationMs: 6000 },
    } });
    const refresh = vi.fn();
    act(() => root.render(<Host speakers={[QUEUE[0]!]} refresh={refresh} />));
    press("Swift Lark");
    press(COPY.theirPlan);
    await flush();
    const level = q("[data-testid=coach-panel-plan-level]")!;
    expect(level.querySelector("h2")!.textContent).toBe(COPY.whichLevel);
    expect(level.textContent).toContain(COPY.whyItMatters);
    expect(level.textContent).toContain("“The window closes once the incumbents match our price.”");
    expect(level.querySelectorAll("[data-plan-player]")).toHaveLength(2);
    // Blind: the five levels, nothing said about which one the machine heard.
    expect(level.textContent).not.toMatch(/machine|heard/i);

    press("Let your key line land");
    await flush();
    expect(pickPlanLevel).toHaveBeenCalledWith("p1", "key_line");
    const facts = [...host.querySelectorAll("[data-testid=coach-panel-plan-reveal] [data-testid=coach-panel-facts] div")]
      .map((d) => d.textContent);
    expect(facts).toEqual([
      "YouLet your key line land", "The machine heardPauses that hold the room", "DeadlineSat 14 Nov", "Stress7",
    ]);
    press(COPY.keepYours);
    expect(refresh).toHaveBeenCalled();
    expect(q("[data-testid=coach-panel-queue]")).not.toBeNull();
  });

  it("a stuck level: its name, the line and Record; Share sends the video as the coach's word and answers the plan", async () => {
    fetchCoachPlan.mockResolvedValue({
      planId: "p3", kind: "stuck", why: null, keyLine: null, levels: [],
      levelName: "Let your key line land", takeSessionId: "take-6",
    });
    uploadCoachVideo.mockResolvedValue("ref-1");
    fetchTakeWord.mockResolvedValue({ ok: true, word: { text: "Lovely ending.", videoUrl: null, videoRef: null, sharedAt: "x" } });
    saveTakeWord.mockResolvedValue({ ok: true, word: null });
    markPlanAnswered.mockResolvedValue(true);
    const refresh = vi.fn();
    act(() => root.render(<Host speakers={[QUEUE[1]!]} refresh={refresh} />));
    press("Bold Finch");
    press(COPY.theirPlan);
    await flush();
    const video = q("[data-testid=coach-panel-plan-video]")!;
    expect(video.querySelector("h2")!.textContent).toBe("Let your key line land");
    expect(video.textContent).toContain(COPY.stuckLine);
    press(COPY.keep);
    expect(q("[data-testid=coach-panel-plan-share] h2")!.textContent).toBe(COPY.readyFor("Bold Finch"));
    press(COPY.shareWith("Bold Finch"));
    await flush();
    expect(uploadCoachVideo.mock.calls[0]![0]).toBe("take-6");
    expect(saveTakeWord).toHaveBeenCalledWith("take-6", { text: "Lovely ending.", videoRef: "ref-1", share: true });
    expect(markPlanAnswered).toHaveBeenCalledWith("p3");
    expect(refresh).toHaveBeenCalled();
    expect(q("[data-testid=coach-panel-queue]")).not.toBeNull();
  });
});
