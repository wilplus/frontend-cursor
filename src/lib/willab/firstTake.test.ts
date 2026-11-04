// @vitest-environment jsdom
/*
STORY    As a new speaker whose onboarding is my first Take, I want "Start your first recording" to open the recording screens on the five questions at once, and my next Take to be my real talk, so that I practise from the first minute.
OUTCOME
  O1  The first Take is its own project, "Your first Take": its deck the plan's five questions, no length, no PDF; the recording screens open on it at Take 1. If the project can't be made, nothing opens.
  O2  Each question shows its small title above it, found by the question's own words; any other slide has none.
  O3  "Record Take 2" from the first Take's goodbye is the real talk: only that project's Take 1, for that speaker.
  O4  The real talk is Take 2 of the first Take's project: its set-up runs afresh with the plan's topic, and its slides are stored on the project as its new slides before its Take is sent; any other Take stores nothing. Without a first Take on this device, nothing changes.
PROVES   O1 -> "the first Take is its own project with the five questions as its deck"
         O1 -> "a project that can't be made opens nothing"
         O2 -> "each question shows its small title"
         O3 -> "only the first Take's project leads to the real talk"
         O4 -> "the real talk is Take 2 of the same project, on its new slides"
WHY      Backend N401 items 2 and 4 (the first Take is the onboarding, locked with the prototypes "The way in" and "The first Take"); the real talk as Take 2, N449 item 1 (with N257's new slides); the rules are docs/flows/the-plan.md.
*/
import { beforeEach, describe, expect, it, vi } from "vitest";

const createProject = vi.fn();
const writeExploreArc = vi.fn();
const updateProjectDeck = vi.fn();
vi.mock("@/services/api/projects", () => ({ createProject: (...a: unknown[]) => createProject(...a) }));
vi.mock("@/services/api/projectDeck", () => ({ updateProjectDeck: (...a: unknown[]) => updateProjectDeck(...a) }));
vi.mock("./exploreArc", () => ({ writeExploreArc: (...a: unknown[]) => writeExploreArc(...a) }));

import {
  FIRST_TAKE_TOPIC,
  firstTakeKicker,
  isFirstTakeArc,
  keepRealTalkSlides,
  realTalkPending,
  startFirstTake,
  startRealTalk,
} from "./firstTake";
import { readActiveSetupDraft } from "./setupDraft";

const SLIDES = [
  { kicker: "About you", title: "What do you do, and what do you know best?", body: "So I can send you the right questions." },
  { kicker: "Your talk", title: "What are you practising for, and why does it matter?", body: "" },
  { kicker: "The room", title: "When is it, and who will be in the room?", body: "" },
  { kicker: "Your one sentence", title: "If they remember one sentence from you, what is it?", body: "Say it the way you'll say it." },
  { kicker: "Your opening", title: "How will you open? Say your first sentence.", body: "" },
];

beforeEach(() => {
  createProject.mockReset();
  writeExploreArc.mockReset();
  updateProjectDeck.mockReset();
  window.localStorage.clear();
});

describe("the first Take", () => {
  it("the first Take is its own project with the five questions as its deck", async () => {
    createProject.mockResolvedValue({ kind: "ok", projectId: "arc-first" });
    const open = vi.fn();
    expect(await startFirstTake(SLIDES, "user-1", open)).toBe(true);
    const [made] = createProject.mock.calls[0];
    expect(made.displayName).toBe(FIRST_TAKE_TOPIC);
    expect(made.setup.slides).toEqual(SLIDES.map((s) => ({ title: s.title, body: s.body })));
    expect(made.setup.target_length_seconds).toBeNull(); // the strip counts up
    expect(made.setup.presentation_mode).toBe("deckless");
    const [owner, arc, takeIndex, deck] = writeExploreArc.mock.calls[0];
    expect([owner, arc, takeIndex, deck.topic, deck.slides.length]).toEqual(["user-1", "arc-first", 1, FIRST_TAKE_TOPIC, 5]);
    expect(open).toHaveBeenCalledOnce();
  });

  it("a project that can't be made opens nothing", async () => {
    createProject.mockResolvedValue({ kind: "error" });
    const open = vi.fn();
    expect(await startFirstTake(SLIDES, "user-1", open)).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(writeExploreArc).not.toHaveBeenCalled();
  });

  it("each question shows its small title", () => {
    expect(SLIDES.map((s) => firstTakeKicker(s.title))).toEqual(SLIDES.map((s) => s.kicker));
    expect(firstTakeKicker("Opening")).toBeNull();
    expect(firstTakeKicker(null)).toBeNull();
  });

  it("only the first Take's project leads to the real talk", async () => {
    createProject.mockResolvedValue({ kind: "ok", projectId: "arc-first" });
    await startFirstTake(SLIDES, "user-1", vi.fn());
    expect(isFirstTakeArc("user-1", "arc-first")).toBe(true);
    expect(isFirstTakeArc("user-1", "arc-other")).toBe(false);
    expect(isFirstTakeArc("user-2", "arc-first")).toBe(false);
    expect(isFirstTakeArc("user-1", "arc-first", 2)).toBe(false); // Take 2's goodbye goes on as any project's
  });

  it("the real talk is Take 2 of the same project, on its new slides", async () => {
    const open = vi.fn();
    expect(startRealTalk("user-1", "My newsroom conference talk", open)).toBe(false); // no first Take here
    expect(open).not.toHaveBeenCalled();

    createProject.mockResolvedValue({ kind: "ok", projectId: "arc-first" });
    await startFirstTake(SLIDES, "user-1", vi.fn());
    writeExploreArc.mockReset();
    expect(startRealTalk("user-1", "My newsroom conference talk", open)).toBe(true);
    expect(writeExploreArc).toHaveBeenCalledWith("user-1", "arc-first", 2); // Take 2, no deck carried
    expect(readActiveSetupDraft("user-1")?.draft?.topic).toBe("My newsroom conference talk");
    expect(open).toHaveBeenCalledOnce();
    expect(realTalkPending("user-1", "arc-first")).toBe(true);

    const deck = { slides: [{ title: "Opening", body: "" }], presentationRef: null };
    await keepRealTalkSlides("user-1", "arc-other", deck);
    expect(updateProjectDeck).not.toHaveBeenCalled(); // any other Take stores nothing
    updateProjectDeck.mockResolvedValue({ ok: true, projectId: "arc-first", nextTake: 2 });
    await keepRealTalkSlides("user-1", "arc-first", deck);
    expect(updateProjectDeck).toHaveBeenCalledWith("arc-first", deck);
    expect(realTalkPending("user-1", "arc-first")).toBe(false); // Take 3 goes on as any project's
  });
});
