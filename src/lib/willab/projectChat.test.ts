/*
STORY    As a speaker, I want Will's shared Coach conversation to stay separate
         from project-specific questions, so project work is never replayed in Coach.
OUTCOME  O1  Project rows remain available to their owning project only.
PROVES   O1 -> the project selector keeps project rows while Coach history excludes them.
*/
import { describe, expect, it } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import {
  isProjectMessage,
  messagesForProject,
  openProjectQuestion,
  orderedProjectMessages,
  projectMessageStaysInLounge,
  speakingCoachMessages,
} from "./projectChat";
import { loungeToHistory } from "@/components/willab/willabHelpers";

function message(over: Partial<LoungeMessage>): LoungeMessage {
  return {
    client_id: over.client_id ?? "message",
    client_created_at: over.client_created_at ?? "2026-11-18T00:00:00.000Z",
    role: over.role ?? "bot",
    kind: over.kind ?? "text",
    body: over.body ?? "",
    metadata: over.metadata ?? null,
  };
}

function row(
  id: string,
  role: LoungeMessage["role"],
  metadata: Record<string, unknown>,
): LoungeMessage {
  return message({ client_id: id, role, metadata });
}

describe("project / Speaking Coach boundary", () => {
  it("keeps project Q&A available to its project but out of Coach history", () => {
    const projectQuestion = message({
      client_id: "project-question",
      role: "bot",
      body: "Who were you talking to?",
      metadata: { arc_id: "arc-a", offer: "will_question" },
    });
    const projectAnswer = message({
      client_id: "project-answer",
      role: "user",
      body: "The board",
      metadata: { arc_id: "arc-a", take_session_id: "take-a" },
    });
    const general = message({
      client_id: "general",
      role: "bot",
      body: "What speaking pattern would you like to work on?",
    });
    const all = [projectQuestion, projectAnswer, general];

    expect(messagesForProject(all, "arc-a")).toEqual([projectQuestion, projectAnswer]);
    expect(speakingCoachMessages(all)).toEqual([general]);
    expect(loungeToHistory(all)).toEqual([
      { role: "assistant", content: "What speaking pattern would you like to work on?" },
    ]);
  });

  it("keeps the newest unanswered project question open", () => {
    const ask = row("1", "bot", {
      arc_id: "arc-a",
      offer: "will_question",
      will_question_step: "ask",
      take_session_id: "take-a",
    });
    expect(openProjectQuestion([ask])).toBe(ask);
    const answer = row("2", "user", {
      arc_id: "arc-a",
      will_question_step: "answer",
      take_session_id: "take-a",
    });
    expect(openProjectQuestion([ask, answer])).toBe(ask);
    expect(openProjectQuestion([ask, answer, row("3", "bot", {
      arc_id: "arc-a",
      will_question_step: "thanks",
      take_session_id: "take-a",
    })])).toBeNull();
  });

  it("keeps the backend's authoritative thanks row in the speaking conversation", () => {
    expect(projectMessageStaysInLounge(row("1", "bot", {
      arc_id: "arc-a",
      take_session_id: "take-a",
      will_question_step: "thanks",
    }))).toBe(true);
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
