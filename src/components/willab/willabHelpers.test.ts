import { describe, expect, it } from "vitest";
import { fmtClock, loungeToHistory, parseVocabulary } from "./willabHelpers";
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
