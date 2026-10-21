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
PROVES   O1, O2, O3 -> "a late word on Take 1, opened from its link, opens Take 1's word; an old link opens as before"
WHY      Founder 2026-10-21 (backend N77, #1212): "the links carry the Take
         the word was written on, and open that Take's coach-only walk with
         the word".
*/
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/chat/page.client", () => ({ default: () => null }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

import ChatPage from "@/app/chat/page";
import { fetchIdealTextEnrichment, mapCoachMessage } from "@/services/api/idealText";
import { walkCoachWord } from "./TranscriptReviewDeck";

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
});
