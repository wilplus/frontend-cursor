/*
STORY    As a speaker, after a Take I want one thing to do at a time: the
         Take's card, its one ask, then the message with "Record Take N".
OUTCOME
  O1  The message waits, undrawn, while its ask is open; the card comes
      before the ask; once let go it comes under what closed the ask.
  O2  A WhatsApp or home-screen ask opens its form by itself.
  O3  A waiting message whose ask is no longer in front of me is let go.
  O4  The admin's ask, stamped only with the message it waits for, is still
      the Take's: the card stays above it and the ask above its buttons
      (founder 2026-10-20: the card landed between the question and its
      buttons).
PROVES   O1 -> "draws the card, the ask, and the message only once it is let go"
         O2 -> "opens the Take's WhatsApp ask by itself"
         O3 -> "knows when no ask is in front of the speaker"
         O4 -> "keeps the card above the admin's ask, stamped with the message it waits for alone"
WHY      Founder 2026-10-20: "You cannot have two actions at a time, like
         feedback and record" (backend services/after_take.py).
*/
import { describe, expect, it } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { afterTakeOrder, askShowing, askToOpen, heldMessage } from "./afterTake";

const at = (n: number) => `2026-10-20T10:00:0${n}.000Z`;
const row = (id: string, n: number, kind: LoungeMessage["kind"], metadata: Record<string, unknown>, body = id): LoungeMessage =>
  ({ client_id: id, role: "bot", kind, body, metadata, client_created_at: at(n) }) as LoungeMessage;
const items = (messages: LoungeMessage[]) => messages.map((message) => ({ message }));
const ids = (messages: LoungeMessage[]) => afterTakeOrder(items(messages)).map((i) => i.message.client_id);

const take = { take_session_id: "t2", arc_id: "a" };
const summary = (held: boolean, n: number) =>
  row("summary", n, "cadence", { summary: true, take_index: 2, ...take, ...(held ? { held_for: "whatsapp" } : {}) });
const ask = row("ask", 2, "text", { offer: "whatsapp", ...take });
const card = row("card", 3, "walk_step", { step: "end", ...take });

describe("after a Take", () => {
  it("draws the card, the ask, and the message only once it is let go", () => {
    const waiting = [summary(true, 1), ask, card];
    expect(ids(waiting)).toEqual(["card", "ask"]);
    expect(heldMessage(waiting)?.client_id).toBe("summary");
    const saved = row("saved", 4, "text", {}, "Saved ✓");
    expect(ids([ask, card, saved, summary(false, 5)])).toEqual(["card", "ask", "saved", "summary"]);
  });

  it("holds the closing message behind the chain and puts the card above its batch (N89)", () => {
    // The chain's row: the summary draws at once; the closing message waits.
    const plain = row("summary", 1, "cadence", { summary: true, take_index: 2, ...take });
    const closing = row("closing", 2, "text", { next_take: true, take_index: 2, ...take, held_for: "whatsapp", chain: [] });
    const whatsapp = row("ask", 3, "text", { offer: "whatsapp", ...take });
    expect(ids([plain, closing, whatsapp, row("card", 4, "walk_step", { step: "end", ...take })])).toEqual(["card", "summary", "ask"]);
    expect(heldMessage([plain, closing, whatsapp])?.client_id).toBe("closing");
    // Let go, it comes under what closed the ask, and the card stays above the batch.
    const gone = row("closing", 5, "text", { next_take: true, take_index: 2, ...take });
    expect(ids([plain, whatsapp, row("card", 4, "walk_step", { step: "end", ...take }), gone])).toEqual(["card", "summary", "ask", "closing"]);
  });

  it("keeps the card above the admin's ask, stamped with the message it waits for alone", () => {
    const question = row("question", 2, "text", { offer: "consent", after_take: "summary" });
    const held = row("summary", 1, "cadence", { summary: true, take_index: 2, ...take, held_for: "admin" });
    expect(ids([held, question, card])).toEqual(["card", "question"]);
  });

  it("opens the Take's WhatsApp ask by itself", () => {
    const drawn = afterTakeOrder(items([summary(true, 1), ask, card])).map((i) => i.message);
    expect(askToOpen(drawn)).toEqual({ id: "ask", type: "whatsapp" });
    expect(askToOpen([...drawn, row("reply", 4, "text", {})])).toBeNull();
  });

  it("knows when no ask is in front of the speaker", () => {
    expect(askShowing([card, ask], false)).toBe(true);
    expect(askShowing([ask, row("reply", 4, "text", {})], false)).toBe(false);
    expect(askShowing([ask, row("reply", 4, "text", {})], true)).toBe(true);
    expect(askShowing([row("missing", 4, "text", { feedback_check: "missing" })], false)).toBe(true);
  });
});
