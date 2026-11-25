// @vitest-environment jsdom
/*
STORY    As a person on the chat builder's ring recording Takes in my chat
         with a speaking host, I want the host's own messages in that chat
         too, each in its place among my Takes, so that nothing I had in the
         chat is gone once it shows my Takes (backend N648 item 8).
OUTCOME  O1  Host messages appear in timestamp order among the Take rows.
         O2  A Take appears once when its member row references its existing coaching exchange.
PROVES   O1 -> "N648-8 the host's messages lie among the Takes by time"
         O2 -> "keeps the member's messages and shows a Take made here only in its coaching exchange"
*/
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/services/api/chats";
import { hostRowsAround, memberRowsForTakeChat } from "./hostChatMessages";

const msg = (id: string, at: string) => ({ id, mine: false, author: "Artur", kind: "text", body: id, meta: null, created_at: at }) as ChatMessage;

describe("a host's chat's own messages among its Takes (N648 item 8)", () => {
  it("N648-8 the host's messages lie among the Takes by time", () => {
    const host = [msg("after-all", "2026-11-11T12:00:00Z"), msg("first", "2026-11-11T08:00:00Z"), msg("between", "2026-11-11T10:00:00Z")];
    // Two Take rows: the Ideal Text card at 09:00, the walk at 11:00.
    const laid = hostRowsAround(host, ["2026-11-11T09:00:00.000Z", "2026-11-11T11:00:00.000Z"]);
    expect(laid.before.map((b) => b.map((m) => m.id))).toEqual([["first"], ["between"]]);
    expect(laid.after.map((m) => m.id)).toEqual(["after-all"]);
    // No Take rows yet: every message after.
    expect(hostRowsAround(host, []).after.map((m) => m.id)).toEqual(["first", "between", "after-all"]);
  });

  it("keeps the member's messages and shows a Take made here only in its coaching exchange", () => {
    const said = msg("h1", "2026-11-11T09:00:00Z");
    const tag = { ...msg("tag", "2026-11-11T09:10:00Z"), kind: "take", meta: { made_here: "take-a" } } as const;
    const received = { ...msg("received", "2026-11-11T09:20:00Z"), kind: "take" } as const;
    expect(memberRowsForTakeChat([said, tag, received])).toEqual([said, received]);
  });
});
