/*
STORY    As a speaker, I want each step of my Feedback walk saved once in the
         Lounge, in the prototype's exact words, with no score and never other
         speakers' recordings, so that my chat history is clean and private.
OUTCOME
  O1  A step seen twice is stored once, as the app's or my own message, with
      no score in it.
  O2  Judging other speakers is posted in the prototype's words, without
      their recording.
  O3  The count of other speakers' moments I judged in a Take comes from my
      own answers in that Take only.
  O4  The sharing question shows as one message, also when it was stored as
      three.
  O5  The Lounge says what the walk's chat said: the practise answer's line
      as shown, and no "Practise" bubble of its own for a try.
  O6  My coach's word for a Take is written into the chat once: not again
      when it shows again, not under its "Later · from your coach" bubble,
      not for an earlier Take's word, not in a replay, not while the chat is
      still loading (N80, D4).
  O7  My most confident moment, when the walk goes on to make it better, is
      named as solid and confident in a line that fits what follows (a
      clearer version, an example, or saying it again), and is never told to
      sound like my confident moment (founder 2026-10-21).
  O8  The hello and the short AI bubble are stored once, and the Lounge
      says the same words as the walk (N120).
PROVES   O1 -> "stores a step seen twice once, as the app's or the speaker's own message, with no score"
         O2 -> "posts judging other speakers as the prototype's chat does, never their recording"
         O3 -> "counts the other speakers' moments the speaker judged in a Take, from their own answer bubbles"
         O4 -> "asks the sharing question as one bubble, its lines as paragraphs, also for a question stored as three"
         O5 -> "says the practise answer the walk showed, and writes no Practise bubble for a try (founder 2026-10-20)"
         O6 -> "writes the coach's word into the chat once per Take"
         O7 -> "names the confident moment for what follows, never with Line A"
         O8 -> "stores the hello and the short AI bubble once, in the walk's own words"
WHY      Never-rule 1 (no scores); locked Feedback walk (lock 2026-10-12);
         founder 2026-10-19, N80 (when the coach changes their word).
*/
import { describe, expect, it } from "vitest";
import { CHUNK_SHEET_COPY as COPY, PRACTISE_LINES, TOP_MOMENT_LINES, WALK_COPY } from "@/components/willab/idealEditCopy";
import { aiVoiceChat, answerBody, coachNoteToChat, momentChat, oneShareQuestion, othersAnswered, othersChat, shareChat, shownStep, stableUuid, walkStepDraft } from "./walkThread";
import type { WalkStep } from "./walkPlan";

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

  it("says the practise answer the walk showed, and writes no Practise bubble for a try (founder 2026-10-20)", () => {
    // The second "not yet" shows the general line's second turn; the Lounge
    // stores that line, not the plan's first turn.
    const shown = PRACTISE_LINES.notYet.general[1];
    const said = shownStep({ key: "encourage", moment: 0, attempt: 2 }, null, null, undefined, shown);
    expect(said?.body).toBe(`${COPY.titlePractise}\n${shown}`);
    expect(answerBody({ key: "exVideo", moment: 0 }, "go")).toBeNull();
    expect(answerBody({ key: "encourage", moment: 0 }, "again")).toBeNull();
    expect(answerBody({ key: "helpers", moment: 0 }, "skip")).toBe(WALK_COPY.skip);
  });

  it("writes the coach's word into the chat once per Take", () => {
    const coachBubble = (take: string, extra: Record<string, unknown> = {}) => ({
      client_id: `${take}-coach`, role: "bot" as const, kind: "walk_step" as const, body: "Your coach\nKeep the pause.",
      metadata: { take_session_id: take, step: "coachnote", author: "coach", ...extra }, client_created_at: "2026-10-19T10:00:00Z",
    });
    const chat = (...messages: ReturnType<typeof coachBubble>[]) => ({ messages, loading: false });
    // The first show of the Take's own word writes it.
    expect(coachNoteToChat(chat(), "t2", "t2", false)).toBe(true);
    // Shown again: the walk's own copy is there already.
    expect(coachNoteToChat(chat(coachBubble("t2")), "t2", "t2", false)).toBe(false);
    // Under the "Later · from your coach" bubble: no second copy.
    expect(coachNoteToChat(chat(coachBubble("t2", { coach_update: true, heading: "Later · from your coach" })), "t2", "t2", false)).toBe(false);
    // Another Take's bubble does not count.
    expect(coachNoteToChat(chat(coachBubble("t1")), "t2", "t2", false)).toBe(true);
    // An earlier Take's word shown as Step 0 of this Take, and a replay.
    expect(coachNoteToChat(chat(), "t2", "t1", false)).toBe(false);
    expect(coachNoteToChat(chat(), "t2", "t2", true)).toBe(false);
    // The chat still loading: what it holds is not known, so no copy yet.
    expect(coachNoteToChat({ messages: [], loading: true }, "t2", "t2", false)).toBe(false);
  });

  it("names the confident moment for what follows, never with Line A", () => {
    const top = {
      index: 0, highest: true, paragraphText: "Hi everyone, I've just been to the cinema.",
      clip: { src: "x", startOffsetMs: null, durationMs: null, snippetId: "s1" },
      exercise: null, clearer: null, praiseWords: [],
    } as unknown as Parameters<typeof shownStep>[1];
    const again = shownStep({ key: "exVideo", moment: 0 }, top, null)?.body ?? "";
    expect(TOP_MOMENT_LINES.again).toContain(again);
    expect(again).not.toContain(WALK_COPY.lineA);
    const video = { ...top, exercise: { video: "https://v", instruction: "Pause before the key words." } } as unknown as typeof top;
    const shown = shownStep({ key: "exVideo", moment: 0 }, video, null)?.body.split("\n") ?? [];
    expect(TOP_MOMENT_LINES.example).toContain(shown[0]);
    const clearer = { ...top, clearer: { say: "I saw the movie.", before: [], after: [], reason: null } } as unknown as typeof top;
    const said = shownStep({ key: "clearer", moment: 0 }, clearer, null, () => "Try it this way:")?.body.split("\n") ?? [];
    expect(TOP_MOMENT_LINES.clearer).toContain(said[0]);
    expect(said[1]).toBe("Try it this way:");
  });
});

describe("the hello and the AI clip's short bubble in the Lounge (founder 2026-10-23, N120)", () => {
  it("stores the hello and the short AI bubble once, in the walk's own words", () => {
    const hello = "Hi Artur, good to see you back!";
    expect(shownStep({ key: "hello" } as WalkStep, null, null, undefined, hello)).toEqual({ author: "app", body: hello });
    const entry = { take: "t1", arcId: "a1", key: "hello", moment: null, attempt: null, author: "app" as const, body: hello };
    // Told twice, one message: the same id each time.
    expect(walkStepDraft(entry).clientId).toBe(walkStepDraft({ ...entry }).clientId);
    const said = aiVoiceChat({ line: "Nice. Lean on “four days”, like this:", then: "Your turn.", practiceId: "p1" });
    expect(said.body).toBe("Nice. Lean on “four days”, like this:\nYour turn.");
    expect(said.extra).toEqual({ ai_voice: { practice_id: "p1", then: "Your turn." } });
    // A praised moment's practise (N122): no second copy of the speaker's
    // clip, and never Line A in the chat.
    const praised = { index: 0, praised: true, praiseWords: [], partId: "p1", paragraphText: "", slideLabel: "Slide 1", clip: null, clearer: null, practiseItem: null, exercise: null, judgeItem: null };
    const practise = { key: "exVideo", moment: 0 } as WalkStep;
    expect(shownStep(practise, praised, null)).toBeNull();
    expect(momentChat([practise], practise, praised)).toBeNull();
  });
});
