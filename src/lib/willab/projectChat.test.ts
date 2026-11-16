/*
STORY    As a speaker, I want each project to keep its own conversation while
         Will keeps general insights, so that take context never leaks lanes.
OUTCOME  O1  Project rows route by arc and stay out of Will.
         O2  Only the newest unanswered project question remains open.
PROVES   O1 -> "keeps project rows out of Will and in their own project"
         O2 -> "keeps the newest unanswered project question open"
WHY      Founder 2026-11-15: project feedback is local; Will is cross-project.
*/
import { describe, expect, it } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { isProjectMessage, messagesForProject, openProjectQuestion, orderedProjectMessages } from "./projectChat";

const row = (id: string, role: "user" | "bot", metadata: Record<string, unknown> | null): LoungeMessage => ({
  client_id: id,
  client_created_at: `2026-11-15T00:00:0${id}.000Z`,
  role,
  kind: "text",
  body: id,
  metadata,
});

describe("project chat routing", () => {
  it("keeps project rows out of Will and in their own project", () => {
    const general = row("1", "bot", null);
    const project = row("2", "bot", { arc_id: "arc-a" });
    expect(isProjectMessage(general)).toBe(false);
    expect(isProjectMessage(project)).toBe(true);
    expect(messagesForProject([general, project], "arc-a")).toEqual([project]);
  });

  it("keeps the newest unanswered project question open", () => {
    const ask = row("1", "bot", {
      arc_id: "arc-a",
      offer: "will_question",
      will_question_step: "ask",
      take_session_id: "take-a",
    });
    expect(openProjectQuestion([ask])).toBe(ask);
    expect(openProjectQuestion([ask, row("2", "user", {
      arc_id: "arc-a",
      will_question_step: "answer",
      take_session_id: "take-a",
    })])).toBeNull();
  });

  it("hides a held closing and releases it after the exchange it closes", () => {
    const summary = row("1", "bot", { arc_id: "arc-a", take_session_id: "take-a", summary: true });
    const held = row("2", "bot", { arc_id: "arc-a", take_session_id: "take-a", next_take: true, held_for: "will_question" });
    const question = row("3", "bot", { arc_id: "arc-a", take_session_id: "take-a", offer: "will_question", will_question_step: "ask" });
    expect(orderedProjectMessages([summary, held, question], "arc-a").map((message) => message.client_id)).toEqual(["1", "3"]);

    const released = row("2", "bot", { arc_id: "arc-a", take_session_id: "take-a", next_take: true });
    const answer = row("4", "user", { arc_id: "arc-a", take_session_id: "take-a", will_question_step: "answer" });
    const reply = row("5", "bot", { arc_id: "arc-a", take_session_id: "take-a", will_question_step: "reply" });
    expect(orderedProjectMessages([summary, released, question, answer, reply], "arc-a").map((message) => message.client_id)).toEqual(["1", "3", "4", "5", "2"]);
  });
});
