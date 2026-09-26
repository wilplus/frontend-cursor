import { describe, expect, it } from "vitest";
import type { CoachReviewSession } from "@/services/api/coachReview";
import { keepStableMediaLinks } from "./useCoachReview";

/* What this protects (founder 2026-09-26): a blind answer refreshes the
   session and the server re-signs every link. The same file must keep the
   link already on screen, or the deck and every clip download again. Nothing
   but the links may come from the previous read. */

function session(over: Partial<CoachReviewSession> & {
  audio?: Record<string, string | null>;
  answer?: string | null;
}): CoachReviewSession {
  const audio = over.audio ?? { a: "https://r2/clip-a.webm?sig=1" };
  return {
    sessionId: "s1",
    videoRef: null,
    presentationRef: "https://r2/deck.pdf?sig=1",
    snippets: Object.entries(audio).map(([id, audioRef]) => ({
      id,
      audioRef,
      ownerAnswer: over.answer ?? null,
    })),
    ...over,
  } as unknown as CoachReviewSession;
}

describe("keepStableMediaLinks", () => {
  it("keeps the link on screen when the file is the same", () => {
    const prev = session({});
    const next = session({
      presentationRef: "https://r2/deck.pdf?sig=2",
      audio: { a: "https://r2/clip-a.webm?sig=2" },
    });
    const kept = keepStableMediaLinks(prev, next);
    expect(kept.presentationRef).toBe("https://r2/deck.pdf?sig=1");
    expect(kept.snippets[0].audioRef).toBe("https://r2/clip-a.webm?sig=1");
  });

  it("takes the new link when the file changed", () => {
    const prev = session({});
    const next = session({ presentationRef: "https://r2/other.pdf?sig=2" });
    expect(keepStableMediaLinks(prev, next).presentationRef).toBe(
      "https://r2/other.pdf?sig=2",
    );
  });

  it("takes everything else from the fresh response", () => {
    const prev = session({ answer: null });
    const next = session({
      answer: "no",
      audio: { a: "https://r2/clip-a.webm?sig=2" },
    });
    const kept = keepStableMediaLinks(prev, next);
    expect(kept.snippets[0].ownerAnswer).toBe("no");
  });

  it("never carries links across sessions", () => {
    const prev = session({});
    const next = session({ sessionId: "s2", presentationRef: "https://r2/deck.pdf?sig=9" });
    expect(keepStableMediaLinks(prev, next)).toBe(next);
  });
});
