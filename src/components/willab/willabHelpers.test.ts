import { describe, expect, it } from "vitest";
import {
  batchTake,
  fmtClock,
  isStrongSidesAsk,
  isUploadAsk,
  loungeToHistory,
  parseVocabulary,
  splitBotMessage,
} from "./willabHelpers";
import type { LoungeMessage } from "@/services/api/loungeMessages";

const m = (over: Partial<LoungeMessage>): LoungeMessage => ({
  client_id: "c",
  role: "user",
  kind: "text",
  body: "b",
  client_created_at: "t",
  ...over,
});

describe("fmtClock", () => {
  it("formats seconds as m:ss with zero-padding", () => {
    expect(fmtClock(0)).toBe("0:00");
    expect(fmtClock(5)).toBe("0:05");
    expect(fmtClock(59)).toBe("0:59");
    expect(fmtClock(60)).toBe("1:00");
    expect(fmtClock(125)).toBe("2:05");
  });

  it("floors fractional seconds and clamps negatives to zero", () => {
    expect(fmtClock(61.9)).toBe("1:01");
    expect(fmtClock(-3)).toBe("0:00");
  });
});

describe("parseVocabulary", () => {
  it("splits on commas, trims, and drops empties", () => {
    expect(parseVocabulary("a, b ,, c,")).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseVocabulary("")).toEqual([]);
    expect(parseVocabulary("   ")).toEqual([]);
  });
});

describe("splitBotMessage", () => {
  it("splits on blank lines into separate bubbles", () => {
    expect(splitBotMessage("First thought.\n\nSecond thought.")).toEqual([
      "First thought.",
      "Second thought.",
    ]);
  });

  it("keeps a single soft newline inside one bubble", () => {
    expect(splitBotMessage("line one\nline two")).toEqual([
      "line one\nline two",
    ]);
  });

  it("returns one element when there is no blank-line break", () => {
    expect(splitBotMessage("just one paragraph")).toEqual([
      "just one paragraph",
    ]);
  });

  it("trims chunks and drops empties (3+ newlines, trailing blanks)", () => {
    expect(splitBotMessage("  a  \n\n\n  b  \n\n")).toEqual(["a", "b"]);
  });

  it("returns [] for empty / whitespace-only bodies", () => {
    expect(splitBotMessage("")).toEqual([]);
    expect(splitBotMessage("   \n  ")).toEqual([]);
  });
});

describe("loungeToHistory", () => {
  it("keeps only user/bot text+joke turns and maps bot → assistant", () => {
    const msgs = [
      m({ role: "user", kind: "text", body: "q1" }),
      m({ role: "bot", kind: "text", body: "a1" }),
      m({ role: "system", kind: "status", body: "ignored" }),
      m({ role: "bot", kind: "insight", body: "ignored2" }),
      m({ role: "user", kind: "joke", body: "knock" }),
    ];
    expect(loungeToHistory(msgs)).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "knock" },
    ]);
  });

  it("caps at the most recent 20 turns", () => {
    const msgs = Array.from({ length: 25 }, (_, i) => m({ body: `m${i}` }));
    const h = loungeToHistory(msgs);
    expect(h.length).toBe(20);
    expect(h[0]?.content).toBe("m5");
    expect(h[19]?.content).toBe("m24");
  });
});

describe("isStrongSidesAsk", () => {
  it("matches an explicit strong-sides ask", () => {
    expect(isStrongSidesAsk("can I see my strong sides?")).toBe(true);
    expect(isStrongSidesAsk("show me my strengths")).toBe(true);
    expect(isStrongSidesAsk("what are my strong points")).toBe(true);
  });

  it("matches the strenghts typo and Polish mocne strony", () => {
    expect(isStrongSidesAsk("Strenghts")).toBe(true);
    expect(isStrongSidesAsk("strenght")).toBe(true);
    expect(isStrongSidesAsk("Mocne strony")).toBe(true);
    expect(isStrongSidesAsk("pokaż moje mocnych stron")).toBe(true);
    // doesn't false-positive on the verb "strengthen"
    expect(isStrongSidesAsk("how do I strengthen my argument?")).toBe(false);
  });

  it("matches an anaphoric follow-up only in a strong-sides context", () => {
    const ctx = "Your strong side from the last session is: ...";
    expect(isStrongSidesAsk("Can i see all of them?", ctx)).toBe(true);
    expect(isStrongSidesAsk("show me the rest", ctx)).toBe(true);
    // same follow-up, non-strong-sides context → no match
    expect(
      isStrongSidesAsk("Can i see all of them?", "here are your recordings")
    ).toBe(false);
    // no context → no match
    expect(isStrongSidesAsk("Can i see all of them?")).toBe(false);
  });

  it("ignores unrelated questions", () => {
    expect(isStrongSidesAsk("how does communication work?")).toBe(false);
    expect(isStrongSidesAsk("what's the weather")).toBe(false);
  });
});

describe("batchTake", () => {
  it("maps absolute take indexes onto the 3-take batch (never 'Take 24 of 3')", () => {
    expect(batchTake(1)).toBe(1);
    expect(batchTake(2)).toBe(2);
    expect(batchTake(3)).toBe(3);
    expect(batchTake(4)).toBe(1); // next batch starts
    expect(batchTake(24)).toBe(3);
    expect(batchTake(25)).toBe(1);
  });

  it("guards junk input", () => {
    expect(batchTake(0)).toBe(1);
    expect(batchTake(-2)).toBe(1);
    expect(batchTake(NaN)).toBe(1);
  });
});

describe("isUploadAsk", () => {
  it("matches explicit upload / attach / import asks", () => {
    expect(isUploadAsk("can I upload an audio file here?")).toBe(true);
    expect(isUploadAsk("can I upload now?")).toBe(true);
    expect(isUploadAsk("let me attach a recording")).toBe(true);
    expect(isUploadAsk("import my mp3")).toBe(true);
  });

  it("matches send/use a file/recording phrasings + Polish", () => {
    expect(isUploadAsk("can I use a file I already have?")).toBe(true);
    expect(isUploadAsk("submit an existing recording")).toBe(true);
    expect(isUploadAsk("add my own audio")).toBe(true);
    expect(isUploadAsk("wgraj plik")).toBe(true);
    expect(isUploadAsk("prześlij nagranie")).toBe(true);
  });

  it("ignores unrelated questions", () => {
    expect(isUploadAsk("how do I sound more confident?")).toBe(false);
    expect(isUploadAsk("what are my strong sides?")).toBe(false);
    expect(isUploadAsk("start recording")).toBe(false);
  });
});
