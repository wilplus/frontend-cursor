// @vitest-environment node
/*
STORY    As a visitor, I get an answer in the host's words, or a plain
         line when the host must see it first. A score about me never
         comes back.
OUTCOME
  O1  The prompt uses what the host does, their first line, their
      questions, taps, what people get back, and their taught examples.
  O2  Shadow, and health, law or money, stay a draft. Only the host
      answers when they said so. An assistant waits for 20 answers.
  O3  A score or a number about the person is stripped. A file that is
      too big is named before it is sent.
PROVES   O1 -> "the prompt is built from the host's setup and examples"
         O2 -> "who answers chooses draft, silence, wait, or send"
         O3 -> "a score about the person is removed, and a huge file is refused"
*/
import { describe, expect, it } from "vitest";
import { ASSISTANT_READY, PHOTO_MAX_BYTES, buildPrompt, fileTooBig, replyAct, stripPersonScores, visitorKind, type ReplySetup } from "./replyPrompt";

const setup = (over: Partial<ReplySetup> = {}): ReplySetup => ({
  spec: "Trichologist",
  hello: "Show me the spot.",
  questions: ["How long has it itched?"],
  taps: ["Dry scalp", "Something else"],
  out: "answer",
  who: "assistant",
  care: false,
  examples: [{ ask: "Is this a dry scalp?", answer: "It looks dry. Use a mild wash." }],
  hostAnswers: ASSISTANT_READY,
  ...over,
});

describe("a reply in the host's words", () => {
  it("the prompt is built from the host's setup and examples", () => {
    const prompt = buildPrompt(setup(), "It itches.", {
      picks: [{ q: "Is this a dry scalp?", opts: ["Yes", "No"] }],
      hasImage: true,
      fileText: "The note says the itch started in May.",
    });
    expect(prompt).toContain("Trichologist");
    expect(prompt).toContain("Show me the spot.");
    expect(prompt).toContain("How long has it itched?");
    expect(prompt).toContain("Dry scalp");
    expect(prompt).toContain("Answer in the host's own words");
    expect(prompt).toContain("Person: Is this a dry scalp?");
    expect(prompt).toContain("Host: It looks dry. Use a mild wash.");
    expect(prompt).toContain("Is this a dry scalp? Options: Yes, No.");
    expect(prompt).toContain("A photo is attached.");
    expect(prompt).toContain("The note says the itch started in May.");
    expect(prompt).toContain("Never give a score");
    expect(prompt).toContain("The person sent: It itches.");
  });

  it("who answers chooses draft, silence, wait, or send", () => {
    expect(replyAct(setup({ who: "you" }))).toBe("none");
    expect(replyAct(setup({ who: "you", care: true }))).toBe("none");
    expect(replyAct(setup({ who: "shadow" }))).toBe("draft");
    expect(replyAct(setup({ who: "assistant", care: true }))).toBe("draft");
    expect(replyAct(setup({ who: "assistant", hostAnswers: 19 }))).toBe("wait");
    expect(replyAct(setup({ who: "assistant", hostAnswers: 20 }))).toBe("send");
    expect(visitorKind({ held: true, reply: "secret" })).toBe("held");
    expect(visitorKind({ quiet: true })).toBe("host");
    expect(visitorKind({ wait: true })).toBe("wait");
    expect(visitorKind({ shown: true, reply: "Use a mild wash." })).toBe("reply");
    expect(visitorKind({ preview: true })).toBe("preview");
    expect(visitorKind(null)).toBe("preview");
  });

  it("a score about the person is removed, and a huge file is refused", () => {
    expect(stripPersonScores("You are an 8/10. Score is 7. Try this.")).toBe("You are an. Try this.");
    expect(stripPersonScores("About 90% sure.")).toBe("About sure.");
    expect(fileTooBig("photo", PHOTO_MAX_BYTES)).toBe(false);
    expect(fileTooBig("photo", PHOTO_MAX_BYTES + 1)).toBe(true);
    expect(visitorKind({ error: "too-big" })).toBe("too-big");
    expect(visitorKind({ error: "unreadable" })).toBe("unreadable");
  });
});
