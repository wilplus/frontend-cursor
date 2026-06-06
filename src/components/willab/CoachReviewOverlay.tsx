"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCoachReview } from "./useCoachReview";
import CoachSnippetReviewCard from "./CoachSnippetReviewCard";
import CoachVideoSlot from "./CoachVideoSlot";
import type { CoachSnippetState } from "@/services/api/coachReview";

/* -------------------------------------------------------------------------- */
/*  CoachReviewOverlay — full-screen takeover for per-session review (§F.2)    */
/*                                                                            */
/*  Mirrors LabOverlay's shape (H1 — full-screen consistency) but mounted      */
/*  over the Lounge, not the Lab, so the coach can close it and return        */
/*  cleanly to the chat thread underneath.                                     */
/*                                                                            */
/*  Identity hygiene (§S.4 / §F.7): the header carries the pseudonym + domain  */
/*  + topic ONLY. No name, no email. Same chrome whether the coach is on the   */
/*  first session or the hundredth.                                            */
/*                                                                            */
/*  Snippet order: BE returns chronologically (§S.3 label hygiene). The FE    */
/*  renders that order verbatim — no best/worst hint, no pre-fill, no AI       */
/*  direction guess in the UI. The coach labels blind.                         */
/*                                                                            */
/*  Publish: deferred to PR 4 (waits on BE 3c — the assemble-from-drafts +    */
/*  notify_client rewire). The overlay shows the §3.10 floor status inline    */
/*  but the publish button itself is wired in the next PR; for now the coach   */
/*  closes the overlay to leave (drafts persist via per-snippet save).        */
/* -------------------------------------------------------------------------- */

export default function CoachReviewOverlay({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { status, session } = useCoachReview(sessionId);

  // Local mirror of per-snippet state, seeded from the payload and updated
  // by each card's save echo. Used to derive the publish-floor status
  // (§3.10) without a session refetch. PR 4 hooks this up to the publish
  // button's enabled state.
  const [localState, setLocalState] = useState<Record<string, CoachSnippetState>>(
    {}
  );

  // Local mirror of the session-level video_ref. Seeded from the payload
  // on load; updated optimistically when the coach uploads a new video so
  // the preview shows immediately without re-fetching the session.
  const [videoRef, setVideoRef] = useState<string | null>(null);
  useEffect(() => {
    if (session) setVideoRef(session.videoRef);
  }, [session]);

  function onSnippetSaved(snippetId: string, next: CoachSnippetState) {
    setLocalState((prev) => ({ ...prev, [snippetId]: next }));
  }

  // §3.10 floor preview: ≥1 surfaced snippet with both a note and a tag.
  // Computed from the latest known state per snippet (payload merged with
  // local saves). PR 4 enables the publish button on this.
  const floorMet = session
    ? session.snippets.some((s) => {
        const cs = localState[s.id] ?? s.coachState;
        return cs.surfaced && cs.note.trim() !== "" && cs.tag !== null;
      })
    : false;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Header — pseudonym only, no real-name surface */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-foreground">
            {session?.pseudonym || "Review session"}
            {session?.domain ? (
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                · {prettifyDomain(session.domain)}
              </span>
            ) : null}
          </p>
          {session?.topic ? (
            <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
              “{session.topic}”
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close review"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
          {status === "loading" ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : status === "error" || !session ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-[15px] text-muted-foreground">
                Couldn&apos;t load this session.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="rounded-full"
              >
                Back to Lounge
              </Button>
            </div>
          ) : session.snippets.length === 0 ? (
            <p className="py-12 text-center text-[15px] text-muted-foreground">
              No analyzable snippets in this session.
            </p>
          ) : (
            <>
              {session.snippets.map((s, i) => (
                <CoachSnippetReviewCard
                  key={s.id}
                  sessionId={session.sessionId}
                  snippet={s}
                  index={i}
                  total={session.snippets.length}
                  onStateChange={onSnippetSaved}
                />
              ))}

              {/* §F.6 — session-level coach video. Optional. Lives between
                  the per-snippet cards and the publish footer so the coach
                  can record a single closing message tying the labeled
                  snippets together. Mobile input triggers the phone camera
                  directly. */}
              <CoachVideoSlot
                sessionId={session.sessionId}
                videoRef={videoRef}
                onUploaded={(nextRef) => setVideoRef(nextRef)}
              />

              {/* Publish footer — disabled in PR 3 (waits on BE 3c rewire).
                  The §3.10 floor preview is computed so the surface is honest
                  about what the publish button will check once it's wired. */}
              <div className="sticky bottom-0 -mx-4 mt-4 border-t border-border bg-background px-4 py-3">
                <div className="mx-auto max-w-2xl">
                  <p className="mb-2 text-center text-[12px] text-muted-foreground">
                    {floorMet
                      ? "Publish floor met — wiring lands with BE 3c."
                      : "Add at least one surfaced snippet with note + tag to publish."}
                  </p>
                  <Button
                    type="button"
                    disabled
                    className="w-full rounded-full"
                  >
                    Publish to user (PR 4)
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function prettifyDomain(domain: string): string {
  switch (domain) {
    case "public_speaking":
      return "Public speaking";
    case "sales":
      return "Sales";
    case "executive_presence":
      return "Executive presence";
    case "customer_service":
      return "Customer service";
    case "interview_prep":
      return "Interview prep";
    default:
      return domain;
  }
}
