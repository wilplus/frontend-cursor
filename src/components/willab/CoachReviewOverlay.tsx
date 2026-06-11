"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCoachReview } from "./useCoachReview";
import CoachSnippetReviewCard from "./CoachSnippetReviewCard";
import CoachVideoSlot from "./CoachVideoSlot";
import { useBackDismiss } from "./useBackDismiss";
import { recutSession } from "@/services/api/recutSession";
import type { CoachSnippetState } from "@/services/api/coachReview";
import {
  publishWillabSession,
  type PublishLabel,
  type PublishNote,
} from "@/services/api/publishWillabSession";

/* -------------------------------------------------------------------------- */
/*  CoachReviewOverlay — full-screen takeover for per-session review           */
/*  (§F.2 + §F.5)                                                              */
/*                                                                            */
/*  Mirrors LabOverlay's shape (H1 — full-screen consistency) but mounted      */
/*  over the Lounge, not the Lab, so the coach can close it and return        */
/*  cleanly to the chat thread underneath.                                     */
/*                                                                            */
/*  Identity hygiene (§S.4 / §F.7): the header carries the pseudonym + domain  */
/*  + topic ONLY. No name, no email. Same chrome whether the coach is on the   */
/*  first session or the hundredth. The success confirmation is name-free too  */
/*  ("Insights published ✓" — no "to Maria", no real-name fallback).           */
/*                                                                            */
/*  Snippet order: BE returns chronologically (§S.3 label hygiene). The FE    */
/*  renders that order verbatim — no best/worst hint, no pre-fill, no AI       */
/*  direction guess in the UI. The coach labels blind.                         */
/*                                                                            */
/*  Publish (§F.5):                                                            */
/*    - Floor: ≥1 surfaced snippet with both note + tag. Server enforces too   */
/*      but the FE button is disabled until the local mirror clears it.        */
/*    - Notify toggle: ON for first publish (state ∈ pending/in_progress),     */
/*      OFF for re-publish (state === done). Maps to body.notify_client.       */
/*    - Body assembled from session.snippets + the local per-snippet save      */
/*      mirror (which IS the BE's persisted truth — every save round-trips).   */
/*      Sent against the existing internal publish endpoint; BE's 3c rewire    */
/*      accepts this shape AND the simplified {overall_message, notify_client} */
/*      future shape — we send the full one for backward compat.               */
/*    - Success → name-free "Insights published ✓" → tap-anywhere closes. The   */
/*      Lounge bubble flips to ✓ done IN PLACE the moment publish succeeds       */
/*      (C2 — onPublished → optimistic markDone); the close-time refresh()        */
/*      then reconciles with server truth.                                        */
/* -------------------------------------------------------------------------- */

export default function CoachReviewOverlay({
  sessionId,
  onClose,
  onPublished,
}: {
  sessionId: string;
  onClose: () => void;
  /** C2 — fired once the publish round-trip succeeds, so the parent can flip
   *  the Lounge bubble to ✓ done in place without waiting on a refetch. */
  onPublished?: (sessionId: string) => void;
}) {
  // D-3 — back-gesture / Back dismisses this overlay instead of routing away.
  useBackDismiss(onClose);
  const { status, session, refresh } = useCoachReview(sessionId);

  // Local mirror of per-snippet state, seeded from the payload and updated
  // by each card's save echo. Used to derive the publish-floor status
  // (§3.10) and assemble the publish payload without a session refetch.
  const [localState, setLocalState] = useState<Record<string, CoachSnippetState>>(
    {}
  );

  // Local mirror of the session-level video_ref. Seeded from the payload
  // on load; updated optimistically when the coach uploads a new video so
  // the preview shows immediately without re-fetching the session.
  const [videoRef, setVideoRef] = useState<string | null>(null);

  // §F.5 publish state — overall message + notify toggle + lifecycle flags.
  // Overall message is saved at publish-time (not per-keystroke) since the
  // BE doesn't expose a draft endpoint for it — it's part of the publish
  // payload itself.
  const [overallMessage, setOverallMessage] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  // E-2 / BE-6 — admin on-demand re-cut. Re-cut mints NEW snippet ids and
  // orphans any labels / notes / drafts on the session, so the BE refuses a
  // labeled session with 409 unless ?force=true. We try WITHOUT force first; on
  // the 409 we surface the BE's exact counts (drafts included — not visible to
  // the FE locally) and let the coach confirm the discard before re-calling.
  const [recutting, setRecutting] = useState(false);
  const [recutError, setRecutError] = useState<string | null>(null);
  const [recutConfirm, setRecutConfirm] = useState<{
    labels: number;
    drafts: number;
  } | null>(null);

  async function handleRecut(force: boolean) {
    if (!session || recutting) return;
    setRecutting(true);
    setRecutError(null);
    const result = await recutSession(session.sessionId, { force });
    if (result.status === "ok") {
      setRecutConfirm(null);
      await refresh(); // pull the new snippets from the canonical read
    } else if (result.status === "needs_confirm") {
      setRecutConfirm({ labels: result.labels, drafts: result.drafts });
    } else {
      setRecutError(result.message);
    }
    setRecutting(false);
  }

  // Seed local state from the session payload on load.
  useEffect(() => {
    if (!session) return;
    setVideoRef(session.videoRef);
    setOverallMessage(session.overallMessage);
    // §F.5 notify toggle defaults:
    //   first publish (pending / in_progress) → ON
    //   re-publish    (done)                  → OFF
    // The coach typically tightens copy on edit without wanting to ping
    // the user a second time.
    setNotifyClient(session.state !== "done");
  }, [session]);

  function onSnippetSaved(snippetId: string, next: CoachSnippetState) {
    setLocalState((prev) => ({ ...prev, [snippetId]: next }));
  }

  // §3.10 floor: ≥1 surfaced snippet with both a note and a tag. Computed
  // from the latest known state per snippet (payload merged with local
  // saves). The publish button is disabled until this clears.
  const floorMet = session
    ? session.snippets.some((s) => {
        const cs = localState[s.id] ?? s.coachState;
        return cs.surfaced && cs.note.trim() !== "" && cs.tag !== null;
      })
    : false;

  async function handlePublish() {
    if (!session || !floorMet || publishing) return;
    setPublishing(true);
    setPublishError(null);

    // Assemble payload from session.snippets + local state mirror.
    // - notes / tags: user lane — only SURFACED snippets with note+tag.
    // - labels:       private lane — every labeled snippet, independent
    //                 of surfaced (§S.1.2 — the two lanes don't cross).
    const notes: PublishNote[] = [];
    const labels: PublishLabel[] = [];
    for (const s of session.snippets) {
      const cs = localState[s.id] ?? s.coachState;
      if (cs.surfaced && cs.note.trim() && cs.tag) {
        notes.push({ snippet_id: s.id, note: cs.note, tag: cs.tag });
      }
      if (cs.directionLabel) {
        labels.push({ snippet_id: s.id, value: cs.directionLabel });
      }
    }

    const result = await publishWillabSession({
      sessionId: session.sessionId,
      overallMessage: overallMessage.trim() || null,
      notes,
      labels,
      notifyClient,
    });

    setPublishing(false);
    if (result.ok) {
      setPublished(true);
      // C2 — flip the Lounge bubble to ✓ done immediately; don't wait for the
      // post-close refetch (BE state may lag). closeReview() still refresh()es
      // to reconcile with server truth.
      onPublished?.(session.sessionId);
    } else {
      setPublishError(result.message);
    }
  }

  // §F.5 / J2 — name-free confirmation. No "to <pseudonym>", no "to Maria"
  // (which would be a §F.7 leak), no email surface. Just the verb.
  // The Lounge bubble already flipped to ✓ done on publish-success (C2 —
  // onPublished); tap-anywhere closes and closeReview() refresh()es to reconcile.
  if (published) {
    return (
      <div
        className="fixed inset-0 z-40 flex cursor-pointer flex-col items-center justify-center gap-4 bg-background p-6 text-center"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Close — insights published"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
      >
        <CheckCircle2 className="h-14 w-14 text-success" aria-hidden />
        <p className="text-[20px] font-semibold text-foreground">
          Insights published
        </p>
        <p className="text-[14px] text-muted-foreground">Tap anywhere to close</p>
      </div>
    );
  }

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
              {/* E-2 / BE-6 — admin on-demand re-cut: re-run the segmenter on
                  this session's stored audio (no upload), then refresh to pull
                  the new snippets. Try without force; the BE 409s if it would
                  orphan labels/drafts, and we confirm with the real counts
                  before re-calling with force. */}
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground">
                      Re-cut snippets
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      Re-run segmentation on the stored audio.
                    </p>
                  </div>
                  {recutConfirm ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRecutConfirm(null)}
                        disabled={recutting}
                        className="rounded-full disabled:opacity-50"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleRecut(true)}
                        disabled={recutting}
                        className="rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {recutting ? "Re-cutting…" : "Re-cut anyway"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleRecut(false)}
                      disabled={recutting}
                      className="shrink-0 rounded-full disabled:opacity-50"
                    >
                      {recutting ? "Re-cutting…" : "Re-cut"}
                    </Button>
                  )}
                </div>
                {recutConfirm ? (
                  <p className="mt-2 text-[12px] text-red-600">
                    This re-cuts the audio into new snippets and discards{" "}
                    {recutConfirm.labels > 0 || recutConfirm.drafts > 0
                      ? `${recutConfirm.labels} label${
                          recutConfirm.labels === 1 ? "" : "s"
                        } and ${recutConfirm.drafts} draft${
                          recutConfirm.drafts === 1 ? "" : "s"
                        }`
                      : "the notes and labels you've added"}{" "}
                    on this session.
                  </p>
                ) : null}
                {recutError ? (
                  <p className="mt-2 text-[12px] text-red-600">{recutError}</p>
                ) : null}
              </div>

              {session.snippets.map((s, i) => (
                <CoachSnippetReviewCard
                  key={s.id}
                  sessionId={session.sessionId}
                  snippet={s}
                  index={i}
                  total={session.snippets.length}
                  presentationRef={session.presentationRef}
                  onStateChange={onSnippetSaved}
                />
              ))}

              {/* Overall message — optional per §14 / red-line 3. The §6b
                  "💬 From your coach" block hides entirely when empty,
                  so an empty submission is honest, not penalized. */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold text-foreground">
                  Overall message
                  <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
                    Shown to user · optional
                  </span>
                </p>
                <textarea
                  value={overallMessage}
                  onChange={(e) => setOverallMessage(e.target.value)}
                  rows={3}
                  placeholder="A warm opener tying these snippets together…"
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-[15px] outline-none focus:border-primary"
                />
              </div>

              {/* §F.6 — session-level coach video. Optional. Lives between
                  the overall message and the publish footer so the coach
                  can record a single closing message tying the labeled
                  snippets together. Mobile input triggers the phone camera
                  directly. */}
              <CoachVideoSlot
                sessionId={session.sessionId}
                videoRef={videoRef}
                onUploaded={(nextRef) => setVideoRef(nextRef)}
              />

              {/* Publish footer (§F.5) — sticky bottom of the scroll area. */}
              <div className="sticky bottom-0 -mx-4 mt-4 border-t border-border bg-background px-4 py-3">
                <div className="mx-auto max-w-2xl">
                  {publishError ? (
                    <p className="mb-2 text-center text-[13px] text-destructive">
                      {publishError}
                    </p>
                  ) : !floorMet ? (
                    <p className="mb-2 text-center text-[12px] text-muted-foreground">
                      Add at least one surfaced snippet with note + tag to
                      publish.
                    </p>
                  ) : null}

                  <label className="mb-2 flex cursor-pointer items-center justify-center gap-2 text-[13px] text-foreground">
                    <input
                      type="checkbox"
                      checked={notifyClient}
                      onChange={(e) => setNotifyClient(e.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-border text-primary accent-primary"
                    />
                    <span>Notify the client about this update</span>
                  </label>

                  <Button
                    type="button"
                    onClick={() => void handlePublish()}
                    disabled={!floorMet || publishing}
                    className="w-full rounded-full"
                  >
                    {publishing ? "Publishing…" : "Publish to user"}
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
