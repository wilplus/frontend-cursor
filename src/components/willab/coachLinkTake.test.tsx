// @vitest-environment jsdom
/*
STORY    As a speaker whose coach left a word on an earlier Take after I
         recorded a newer one, I want the WhatsApp or email link to open my
         coach's feedback on the Take the word was written on, with the
         word, so that the coach's link opens the coach's feedback.
OUTCOME
  O1  A link naming its Take (`&take=`) opens the coach-only walk on that
      Take's word: the page asks the server for that Take's word and the
      coach's door opens it, never another Take's.
  O2  An old link without `take` opens as before: nothing extra is asked
      and the coach's door opens the word the server sent.
  O3  Opening the Take on screen's own review (any other door) never shows
      the earlier Take's word.
  O4  A link naming an earlier Take shows only that Take's word, then
      Continue: no coach moment answers follow, since those are the latest
      Take's and never mix with another Take's word.
  O5  A link naming the latest Take shows the word, then that Take's coach
      moment answers, as before.
PROVES   O1, O2, O3 -> "a late word on Take 1, opened from its link, opens Take 1's word; an old link opens as before"
         O4, O5 -> "a link to an earlier Take shows its word and no moments of the latest Take; a link to the latest Take shows the word, then its moments"
WHY      Founder 2026-10-21 (backend N77, #1212): "the links carry the Take
         the word was written on, and open that Take's coach-only walk with
         the word"; founder 2026-10-21 again: an earlier Take's link
         shows only its word, never the latest Take's moments.
*/
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/chat/page.client", () => ({ default: () => null }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

import ChatPage from "@/app/chat/page";
import { buildFeedbackWalk, type FeedbackWalkItem } from "@/lib/willab/feedbackWalkModel";
import { fetchIdealTextEnrichment, mapCoachMessage } from "@/services/api/idealText";
import { coachLinkNamesEarlierTake, walkCoachWord } from "./TranscriptReviewDeck";

const TAKE_1 = "11111111-0000-4000-8000-000000000001";
const TAKE_2 = "22222222-0000-4000-8000-000000000002";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const linkProps = (searchParams: Record<string, string>) =>
  ChatPage({ searchParams }).props.children.props as {
    idealTextArcId: string | null;
    idealTextMode: string | null;
    idealTextTake: string | null;
  };

/** The server's journey answer: Take 1's word when the read names Take 1,
 *  nothing for Take 2 (on screen), as backend N77 serves it. */
function serverWith(url: string) {
  const asked = new URL(url, "https://app.test").searchParams.get("take");
  const word = asked === TAKE_1
    ? { text: "Slow down on the price.", video_url: null, take_index: 1, take_session_id: TAKE_1, unseen: true }
    : null;
  return {
    ok: true,
    status: 200,
    json: async () => ({
      document_snapshot_id: "snap-2",
      sections: { journey: { status: "ready", data: { journey_next_steps_seen: true, coach_message: word } } },
    }),
  };
}

async function openedWord(take: string | null, door: { coachOnly: boolean }) {
  const fetchMock = vi.fn(async (url: string) => serverWith(url));
  vi.stubGlobal("fetch", fetchMock);
  const read = await fetchIdealTextEnrichment("arc-1", "snap-2", ["journey"], take);
  if (read.kind !== "ready") throw new Error("expected the journey");
  const raw = read.sections.journey?.data?.coach_message;
  const word = walkCoachWord(mapCoachMessage(raw), {
    coachOnly: door.coachOnly,
    coachTake: take,
    takeSessionId: TAKE_2,
    takeCount: 2,
  });
  return { word, url: String(fetchMock.mock.calls[0]?.[0]) };
}

describe("the coach's link names the word's Take (backend N77)", () => {
  it("a late word on Take 1, opened from its link, opens Take 1's word; an old link opens as before", async () => {
    const links: Record<string, string>[] = [
      { lens: "arc-1", take: TAKE_1 },
      { idealArc: "arc-1", feedback: "1", take: TAKE_1 },
    ];
    for (const link of links) {
      const props = linkProps(link);
      expect(props).toMatchObject({ idealTextArcId: "arc-1", idealTextMode: "feedback", idealTextTake: TAKE_1 });
      const opened = await openedWord(props.idealTextTake, { coachOnly: true });
      expect(opened.url).toContain(`take=${TAKE_1}`);
      expect(opened.word).toMatchObject({ text: "Slow down on the price.", takeIndex: 1, takeSessionId: TAKE_1 });
    }

    // O2: an old link carries no Take; the read asks for none.
    const old = linkProps({ lens: "arc-1" });
    expect(old.idealTextTake).toBeNull();
    const before = await openedWord(old.idealTextTake, { coachOnly: true });
    expect(before.url).not.toContain("take=");
    expect(before.word).toBeNull();

    // O3: the review of Take 2, the Take on screen, never shows Take 1's word.
    const review = await openedWord(TAKE_1, { coachOnly: false });
    expect(review.word).toBeNull();
  });

  it("a link to an earlier Take shows its word and no moments of the latest Take; a link to the latest Take shows the word, then its moments", () => {
    // The coach's answer on a moment of Take 2, the latest Take, the one on screen.
    const answered = {
      partId: "p1", start: 0, blockId: "b1", slide: 0, paragraphText: "words of p1", slideLabel: "Slide 1",
      tiered: true, coachAnswered: true,
      coachAnswer: { kind: "note", text: "Breathe first.", videoUrl: null }, coachItem: "s-n",
    } as FeedbackWalkItem<string>;
    const walkFrom = (coachTake: string) => {
      const door = { coachOnly: true, coachTake, takeSessionId: TAKE_2 };
      return buildFeedbackWalk({
        items: [answered],
        coachNote: true,
        practiceOn: true,
        guest: false,
        coachOnly: true,
        coachWordOnly: coachLinkNamesEarlierTake(door),
      }).plan.map((step) => step.key);
    };

    // O4: Take 1's link: its word, then Continue onto the end; nothing of Take 2.
    expect(walkFrom(TAKE_1)).toEqual(["page", "coachnote", "end"]);
    // O5: Take 2's link: the word, then the coach's answers on its moments.
    expect(walkFrom(TAKE_2)).toEqual(["page", "coachnote", "coach", "end"]);
  });
});
