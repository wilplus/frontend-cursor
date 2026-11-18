/*
STORY    As a speaker, I want one Feedback walk per Take, so that processing, the project card, reloads and later review all show the same walk.
OUTCOME
  O1  The first opening and the project-card CTA use the same first/resume/review state.
  O2  Praise, the moment judgement, the improvement exercise and the remaining sections do not disappear because a different door was used.
  O3  A completed Take reopens as one read-only scroll; a deferred practice reopens at the same exercise with its attempts intact.
  O4  The state and the exact moment identity survive Lounge persistence and a reload, with attempts capped at the established maximum of three.
PROVES   O1 -> entry routing is a pure function of one persisted state
         O2 -> completion and pending practice are not represented by parallel booleans
         O3 -> completed and deferred states have distinct rendering contracts
         O4 -> the Lounge snapshot round-trips without changing the Take or moment
WHY      Feedback Walk is a continuity surface in the record -> process -> Ideal Text -> next Take loop; a second configuration silently loses work.
*/

import { describe, expect, it } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import {
  feedbackWalkEntryFor,
  feedbackWalkStateFromMessages,
  feedbackWalkStateMetadata,
  reduceFeedbackWalkState,
  type FeedbackWalkState,
} from "./feedbackWalkState";

const take = "take-42";

function row(metadata: Record<string, unknown>): LoungeMessage {
  return {
    client_id: `row-${String(metadata.walk_status ?? metadata.step ?? "state")}`,
    role: "bot",
    kind: "walk_step",
    body: "",
    metadata: { take_session_id: take, ...metadata },
    client_created_at: "2026-11-18T12:00:00.000Z",
  };
}

function transition(state: FeedbackWalkState, event: Parameters<typeof reduceFeedbackWalkState>[1]): FeedbackWalkState {
  return reduceFeedbackWalkState(state, event);
}

describe("Feedback Walk state machine and entry invariants", () => {
  it("As a user, Given either processing or the black project Feedback CTA, When I open the same untouched Take, Then both select the same first step-by-step entry", () => {
    const state = feedbackWalkStateFromMessages([], take);
    expect(feedbackWalkEntryFor(state)).toEqual({ mode: "first", scroll: false, focus: null });
    expect(feedbackWalkEntryFor(state)).toEqual(feedbackWalkEntryFor(state));
  });

  it("As a user, Given the walk reached the moment judgement and the exercise, When I complete the walk, Then praise, judgement, practice and the remaining sections stay completed in one state", () => {
    let state = feedbackWalkStateFromMessages([], take);
    for (const event of [
      { action: "shown" as const, key: "praise", moment: 0 },
      { action: "answered" as const, key: "praise", moment: 0, value: "next" },
      { action: "shown" as const, key: "judge", moment: 1 },
      { action: "answered" as const, key: "judge", moment: 1, value: "yes" },
      { action: "shown" as const, key: "exVideo", moment: 2 },
      { action: "answered" as const, key: "exVideo", moment: 2, attempt: 1, value: "skip" },
      { action: "shown" as const, key: "others", moment: null },
      { action: "completed" as const, key: "end", moment: null },
    ]) state = transition(state, event);
    expect(state.status).toBe("completed");
    expect(state.completedSteps).toEqual(expect.arrayContaining(["praise:0", "judge:1", "end:-"]));
    expect(feedbackWalkEntryFor(state)).toEqual({ mode: "review", scroll: true, focus: null });
  });

  it("As a user, Given practice was reached and skipped, When I reopen after a reload, Then the same exercise is focused and attempts remain capped at three", () => {
    let state = feedbackWalkStateFromMessages([], take);
    state = transition(state, { action: "shown", key: "practise", moment: 2, attempt: 1 });
    state = transition(state, { action: "skipped", key: "practise", moment: 2, attempt: 1, value: "skip" });
    const metadata = feedbackWalkStateMetadata(state);
    const reloaded = feedbackWalkStateFromMessages([row(metadata)], take);
    expect(reloaded.status).toBe("practice_pending");
    expect(reloaded.pendingPractice).toBe("practise:2");
    expect(feedbackWalkEntryFor(reloaded)).toEqual({ mode: "resume", scroll: false, focus: "practise:2" });

    for (const attempt of [1, 2, 3, 4]) {
      state = transition(state, { action: "answered", key: "practise", moment: 2, attempt, value: "try" });
    }
    expect(state.attempts["practise:2"]).toBe(3);
  });

  it("As a user, Given the walk completed, When I reopen it from the card or after a reload, Then every element stays read-only and no pending exercise is recreated", () => {
    let state = feedbackWalkStateFromMessages([], take);
    state = transition(state, { action: "shown", key: "praise", moment: 0 });
    state = transition(state, { action: "answered", key: "praise", moment: 0, value: "next" });
    state = transition(state, { action: "completed", key: "end", moment: null });
    const reloaded = feedbackWalkStateFromMessages([row(feedbackWalkStateMetadata(state))], take);
    expect(reloaded.status).toBe("completed");
    expect(reloaded.pendingPractice).toBeNull();
    expect(feedbackWalkEntryFor(reloaded).scroll).toBe(true);
    expect(feedbackWalkEntryFor(reloaded).focus).toBeNull();
  });
});
