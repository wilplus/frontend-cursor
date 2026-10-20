/*
STORY    As a speaker, I want Will to answer what sits right above my message
         in the chat, and my chat to keep the order it shows, so that a reply
         never misreads my number, my tap or my Take's feedback.
OUTCOME
  O1  Will reads every bubble in the order the chat draws it: the Take's
      card in words (with the coach's feedback when its dot is on), the
      summary, the ask, and my own words.
  O2  What the chat adds sorts under the newest bubble on screen, even when
      this device's clock is behind the server's.
  O3  The newest ask on screen is known, so it is not asked a second time.
PROVES   O1 -> "tells Will the screen in its order, cards in words"
         O2 -> "stamps a new bubble under the newest one on screen"
         O3 -> "knows the ask that shows last"
WHY      Founder 2026-10-20: "the conversational chat should be aware of the
         order of bubbles it displays" (a number typed under the WhatsApp ask
         got a generic reply and the ask again; a card jumped under "Skip").
*/
import { describe, expect, it } from "vitest";
import { stampLoungeMessage, type LoungeMessage } from "@/services/api/loungeMessages";
import { newestAsk, OFFER_PROMPT } from "./loungeOffers";
import { screenHistory } from "./loungeScreen";

const at = (n: number) => new Date(Date.UTC(2026, 9, 20, 10, 0, n)).toISOString();
const msg = (id: string, n: number, part: Partial<LoungeMessage>): LoungeMessage => ({
  client_id: id,
  client_created_at: at(n),
  role: "bot",
  kind: "text",
  body: "",
  metadata: null,
  ...part,
});

const card = msg("end", 1, { kind: "walk_step", metadata: { step: "end", arc_id: "arc-1", take_session_id: "t1" } });
const summary = msg("sum", 2, {
  kind: "cadence",
  body: "We have successfully registered your first take 🎉",
  metadata: { summary: true, arc_id: "arc-1", take_session_id: "t1", take_index: 1 },
});
const ask = msg("ask", 3, { body: OFFER_PROMPT.whatsapp, metadata: { offer: "whatsapp" } });
const helpers = msg("helpers", 4, { kind: "walk_step", body: "Choose your helper words", metadata: { step: "helpers" } });
const clip = msg("clip", 5, { role: "user", kind: "walk_step", metadata: { step: "clip:praise" } });
const typed = msg("me", 6, { role: "user", body: "07700 900461" });
const facts = {
  cardOf: (m: LoungeMessage) => (m.client_id === "end" ? { title: "ted", take: 1 } : null),
  coachWaits: (m: LoungeMessage) => m.client_id === "end",
};

describe("the chat as Will reads it", () => {
  it("tells Will the screen in its order, cards in words", () => {
    expect(screenHistory([card, summary, ask, helpers, clip, typed], facts)).toEqual([
      {
        role: "assistant",
        content:
          '[On screen: the Ideal Text card of "ted", Take 1. It wears the orange stroke and dot: ' +
          "the coach's feedback is in and not opened yet; a tap opens it.]",
      },
      { role: "assistant", content: summary.body },
      { role: "assistant", content: OFFER_PROMPT.whatsapp },
      { role: "assistant", content: "Choose your helper words" },
      { role: "user", content: "07700 900461" },
    ]);
    const plain = { ...facts, coachWaits: () => false };
    expect(screenHistory([card], plain)[0].content).toBe('[On screen: the Ideal Text card of "ted", Take 1. A tap opens the text.]');
  });

  it("stamps a new bubble under the newest one on screen", () => {
    const ahead = new Date(Date.now() + 60_000).toISOString();
    const added = stampLoungeMessage({ role: "user", kind: "text", body: "Yes" }, ahead);
    expect(Date.parse(added.client_created_at)).toBe(Date.parse(ahead) + 1);
    const later = stampLoungeMessage({ role: "user", kind: "text", body: "Yes" }, at(1));
    expect(Date.parse(later.client_created_at)).toBeGreaterThan(Date.parse(at(1)));
  });

  it("knows the ask that shows last", () => {
    expect(newestAsk([summary, ask, helpers, typed])).toBe("whatsapp");
    const check = msg("check", 7, { body: OFFER_PROMPT.feedback_check, metadata: { offer: "feedback_check" } });
    expect(newestAsk([ask, check])).toBe("feedback_check");
    expect(newestAsk([summary, helpers])).toBeNull();
  });
});
