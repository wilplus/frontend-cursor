import { describe, expect, it } from "vitest";
import { WALK_COPY } from "@/components/willab/idealEditCopy";
import { oneShareQuestion, othersAnswered, othersChat, shareChat, stableUuid, walkStepDraft } from "./walkThread";

describe("the walk's steps in the Lounge (lock 2026-10-12, section 1)", () => {
  it("stores a step seen twice once, as the app's or the speaker's own message, with no score", () => {
    const entry = { take: "t1", arcId: "a1", key: "praise", moment: 0, attempt: null, author: "app" as const, body: "Good job" };
    const first = walkStepDraft(entry);
    expect(walkStepDraft(entry).clientId).toBe(first.clientId);
    expect(first.clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.role).toBe("bot");
    expect(walkStepDraft({ ...entry, author: "speaker", key: "try" }).role).toBe("user");
    expect(walkStepDraft({ ...entry, moment: 1 }).clientId).not.toBe(first.clientId);
    expect(stableUuid("x")).not.toBe(stableUuid("y"));
    expect(JSON.stringify(first.metadata)).not.toMatch(/score|band|read/i);
  });

  it("posts judging other speakers as the prototype's chat does, never their recording", () => {
    const shown = othersChat(0, 2, null, null);
    expect(shown?.body).toBe("Now 2 moments from other speakers.");
    expect(shown?.extra).toEqual({ hint: "Does this sound confident to you?", heading: "Other speakers" });
    expect(othersChat(1, 2, "Invita", null)?.body).toBe("Moment 2 of 2");
    expect(othersChat(0, 1, null, "yes")).toMatchObject({ author: "speaker", body: "👍 Yes" });
    expect(JSON.stringify(shown)).not.toMatch(/clip|src|http/);
  });

  it("counts the other speakers' moments the speaker judged in a Take, from their own answer bubbles", () => {
    const at = (take: string, step: string, kind = "walk_step") => ({
      client_id: `${take}-${step}`, role: "user" as const, kind: kind as "walk_step", body: "👍 Yes",
      metadata: { take_session_id: take, step }, client_created_at: "2026-10-18T10:00:00Z",
    });
    const messages = [at("t1", "others"), at("t1", "answer:others"), at("t1", "answer:others"), at("t2", "answer:others"), at("t1", "answer:others", "text")];
    expect(othersAnswered(messages, "t1")).toBe(2);
    expect(othersAnswered(messages, "t3")).toBe(0);
  });
  it("asks the sharing question as one bubble, its lines as paragraphs, also for a question stored as three", () => {
    const question = `${WALK_COPY.shareBefore}\n\n${WALK_COPY.shareTitle}\n\n${WALK_COPY.shareAudience}`;
    const posted = shareChat(3, ["none"], []);
    expect(posted.map((d) => [d.role, d.body])).toEqual([
      ["user", "Record Take 3"],
      ["bot", question],
      ["user", WALK_COPY.shareOnlyMe],
    ]);
    const stored = (role: "user" | "bot", body: string, i: number) => ({
      message: {
        client_id: `m${i}`, role, kind: "walk_step" as const, body,
        metadata: { step: "share" }, client_created_at: `2026-10-18T10:00:0${i}Z`,
      },
    });
    const old = [
      stored("user", "Record Take 3", 0),
      stored("bot", WALK_COPY.shareBefore, 1),
      stored("bot", WALK_COPY.shareTitle, 2),
      stored("bot", WALK_COPY.shareAudience, 3),
      stored("user", WALK_COPY.shareOnlyMe, 4),
    ];
    expect(oneShareQuestion(old).map((x) => x.message.body)).toEqual(["Record Take 3", question, WALK_COPY.shareOnlyMe]);
  });
});
