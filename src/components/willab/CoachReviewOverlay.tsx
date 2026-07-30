"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { VoiceMark } from "./LoadingState";
import OverlayCloseButton from "./OverlayCloseButton";
import { Button } from "@/components/ui/button";
import { useCoachReview } from "./useCoachReview";
import CoachSnippetReviewCard from "./CoachSnippetReviewCard";
import CoachVideoSlot from "./CoachVideoSlot";
import { useBackDismiss } from "./useBackDismiss";
import SnippetScreenShell from "./SnippetScreenShell";
import { recutSession } from "@/services/api/recutSession";
import type { CoachSnippetState, SessionFeeling } from "@/services/api/coachReview";
import {
  type PublishLabel,
  type PublishNote,
  type PublishSnippetState,
} from "@/services/api/publishWillabSession";
import { saveCoachFeedback } from "@/services/api/saveCoachFeedback";
import {
  fetchCoachReviewState,
  type CoachReviewState,
  type PublishBlocker,
} from "@/services/api/coachReviewState";
import { publishArc } from "@/services/api/arcBatch";
import {
  clearCoachReviewDraft,
  readCoachReviewDraft,
  writeCoachReviewDraft,
} from "@/lib/willab/coachReviewDraft";

/** Map a publish blocker to the disabled-PUBLISH reason (FE-2). */
function blockerReason(b: PublishBlocker): string {
  switch (b) {
    case "TAKES_NOT_SAVED":
      return "Save each recording's feedback first";
    case "IDEAL_TEXT_NOT_APPROVED":
      return "Verify the ideal text first";
    case "NO_TAKES":
      return "No recordings to publish yet";
  }
}

const FEELING_EMOJI: Record<string, string> = {
  nervous: "😬",
  excited: "🔥",
  calm: "😌",
  unsure: "🤔",
};

function FeelingBadge({ feeling }: { feeling: SessionFeeling }) {
  const emoji = FEELING_EMOJI[feeling.feeling] ?? "";
  const label =
    feeling.feeling.charAt(0).toUpperCase() + feeling.feeling.slice(1);
  const takeLabel = feeling.takeIndex != null ? ` · Take ${feeling.takeIndex}` : "";
  return (
    <span>
      {emoji} {label}
      {takeLabel}
    </span>
  );
}

export default function CoachReviewOverlay({
  sessionId,
  onClose,
  onPublished,
  onOpenArcIdeal,
}: {
  sessionId: string;
  onClose: () => void;
  onPublished?: (sessionId: string) => void;
  /** FP-1 — open this arc's ideal-text panel directly from the wrap-up cue
   *  (the founder's missing path). Optional: without it the cue is plain text. */
  onOpenArcIdeal?: (arcId: string) => void;
}) {
  useBackDismiss(onClose);
  const { status, session, refresh } = useCoachReview(sessionId);

  // R4-8 — crash-safety draft, read ONCE synchronously at mount so the snippet
  // cards can seed from it (they mount as soon as the session loads). Holds an
  // unpublished review that a closed tab would otherwise have lost.
  const [draftCache] = useState(() => readCoachReviewDraft(sessionId));
  const [localState, setLocalState] = useState<Record<string, CoachSnippetState>>(
    () => draftCache?.snippets ?? {}
  );
  const [videoRef, setVideoRef] = useState<string | null>(null);
  const [overallMessage, setOverallMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  // "saving" = the per-take Save checkpoint; "delivered" = the arc PUBLISH
  // succeeded (the terminal state). Separated so a Save no longer masquerades
  // as the end of the flow (FE-2 gives the coach Open-ideal → Publish after).
  const [savedFlash, setSavedFlash] = useState(false);
  const [delivered, setDelivered] = useState(false);
  // FE-2 — the wrap-up's single read: per-take review states + ideal-text
  // assembly/approval + can_publish/blockers (mirrors publish-analysis's gate).
  const [reviewState, setReviewState] = useState<CoachReviewState | null>(null);
  const [cursor, setCursor] = useState(0);
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
      setCursor(0);
      await refresh();
    } else if (result.status === "needs_confirm") {
      setRecutConfirm({ labels: result.labels, drafts: result.drafts });
    } else {
      setRecutError(result.message);
    }
    setRecutting(false);
  }

  useEffect(() => {
    if (!session) return;
    setVideoRef(session.videoRef);
    // R4-8 — a crash-cache draft wins over the server overall message (the
    // coach was mid-edit); otherwise seed from the server as before.
    setOverallMessage((prev) =>
      draftCache ? draftCache.overallMessage || prev : session.overallMessage
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const onSnippetSaved = useCallback((snippetId: string, next: CoachSnippetState) => {
    setLocalState((prev) => ({ ...prev, [snippetId]: next }));
  }, []);

  // R4-8 — mirror the in-progress review to localStorage (debounced) as crash
  // insurance. No server traffic; stops once the arc is delivered.
  useEffect(() => {
    if (!session || delivered) return;
    const id = setTimeout(() => {
      writeCoachReviewDraft(sessionId, overallMessage, localState);
    }, 400);
    return () => clearTimeout(id);
  }, [sessionId, session, localState, overallMessage, delivered]);

  // FE-2 — load the wrap-up read once the arc id is known, and refresh it while
  // the coach sits on the wrap-up (so approving in the ideal-text panel, which
  // stacks over this overlay, flips PUBLISH live on return). Stops once the arc
  // is delivered / published.
  const arcId = session?.arcId ?? null;
  const refreshReviewState = useCallback(async () => {
    if (!arcId) return;
    const r = await fetchCoachReviewState(arcId);
    if (r) setReviewState(r);
  }, [arcId]);

  const atWrapupNow = !!session && cursor === session.snippets.length;
  useEffect(() => {
    if (!arcId) return;
    void refreshReviewState();
  }, [arcId, refreshReviewState]);
  useEffect(() => {
    if (!arcId || !atWrapupNow || delivered) return;
    if (reviewState?.published) return;
    const id = setInterval(() => void refreshReviewState(), 5000);
    return () => clearInterval(id);
  }, [arcId, atWrapupNow, delivered, reviewState?.published, refreshReviewState]);

  // FE-8 — informational only, NEVER a save gate: "reviewed, nothing to
  // surface" is a valid coach verdict. The BE stamps coach_feedback_saved_at
  // on an EMPTY save by design (test_save_feedback_no_body_still_stamps), and
  // publish-analysis flips takes with zero surfaced snippets. The old FE floor
  // ("surface ≥1 snippet + note to save") deadlocked publishing on such takes.
  // Tests SURFACED alone — the save payload persists `surfaced` regardless of
  // notes, so a surfaced note-less snippet still reaches the user and must not
  // trip a "user gets nothing" banner.
  const nothingSurfaced = session
    ? !session.snippets.some(
        (s) => (localState[s.id] ?? s.coachState).surfaced
      )
    : true;

  // Delivery layer — the per-take action is a SAVE checkpoint, not a publish:
  // it persists the take's drafts + stamps coach_feedback_saved_at server-side
  // and delivers NOTHING. The user only receives the 4 bubbles at the arc-level
  // PUBLISH on the wrap-up, which requires all takes saved + the ideal text
  // approved.
  async function handleSaveFeedback() {
    if (!session || saving || publishing) return;
    setSaving(true);
    setPublishError(null);

    const notes: PublishNote[] = [];
    const labels: PublishLabel[] = [];
    // The full per-snippet state array persists in one shot (R4-8 save-on-
    // publish became save-on-Save); notes/labels ride along for back-compat.
    const snippets: PublishSnippetState[] = [];
    for (const s of session.snippets) {
      const cs = localState[s.id] ?? s.coachState;
      snippets.push({
        id: s.id,
        note: cs.note,
        direction: cs.directionLabel,
        tag: cs.tag,
        surfaced: cs.surfaced,
      });
      if (cs.surfaced && cs.note.trim()) {
        notes.push({ snippet_id: s.id, note: cs.note, tag: cs.tag ?? "strong" });
      }
      if (cs.directionLabel) {
        labels.push({ snippet_id: s.id, value: cs.directionLabel });
      }
    }

    const result = await saveCoachFeedback({
      sessionId: session.sessionId,
      overallMessage: overallMessage.trim() || null,
      notes,
      labels,
      snippets,
    });

    setSaving(false);
    if (result.ok) {
      // The saved truth is on the server now; the crash draft is stale. Stay on
      // the wrap-up (the coach still opens the ideal text + publishes) and flash
      // a confirmation; refresh review-state so takes_saved / blockers update.
      // NOTE: do NOT call onPublished here — that's reviewQueue.markDone, the
      // terminal "delivered" marker. A Save only stamps coach_feedback_saved_at
      // (in_progress); the queue bubble picks that up via closeReview's refresh.
      // Marking done on a mere save would falsely report delivery and drop the
      // "still needs publishing" signal. onPublished stays PUBLISH-only.
      clearCoachReviewDraft(session.sessionId);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
      void refreshReviewState();
    } else {
      setPublishError(result.message ?? "Couldn't save. Try again.");
    }
  }

  // FE-2 — the final PUBLISH: only reachable once the ideal text is approved
  // (the button is gated on reviewState.ideal.approved) and every precondition
  // is met (can_publish). publish-analysis is still the server-side gate — its
  // 409s shouldn't fire now, but arcBatch surfaces them if they do.
  async function handlePublish() {
    if (!arcId || publishing) return;
    setPublishing(true);
    setPublishError(null);
    const r = await publishArc(arcId);
    setPublishing(false);
    if (r.kind === "ok") {
      clearCoachReviewDraft(sessionId);
      setDelivered(true);
      onPublished?.(sessionId);
    } else {
      setPublishError(r.message);
      void refreshReviewState();
    }
  }

  if (delivered) {
    return (
      <div
        className="fixed inset-0 z-40 flex cursor-pointer flex-col items-center justify-center gap-4 bg-background p-6 text-center"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Close, analysis delivered"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
      >
        <CheckCircle2 className="h-14 w-14 text-success" aria-hidden />
        <p className="text-[20px] font-semibold text-foreground">Delivered</p>
        <p className="text-[14px] text-muted-foreground">
          The full analysis is on its way to the student. Tap anywhere to close.
        </p>
      </div>
    );
  }

  // Pre-shell states (loading / error / no snippets yet).
  if (status === "loading" || !session) {
    return (
      <PreShellOverlay onClose={onClose}>
        {status === "loading" ? (
          <VoiceMark size={48} />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-[15px] text-muted-foreground">
              Couldn&apos;t load this session.
            </p>
            <Button type="button" variant="outline" onClick={onClose} className="rounded-full">
              Back to Lounge
            </Button>
          </div>
        )}
      </PreShellOverlay>
    );
  }

  if (session.snippets.length === 0) {
    return (
      <PreShellOverlay onClose={onClose}>
        <p className="text-[15px] text-muted-foreground">
          No analyzable snippets in this session.
        </p>
      </PreShellOverlay>
    );
  }

  const total = session.snippets.length + 1; // last page = wrap-up
  const isAtWrapup = cursor === session.snippets.length;

  return (
    <SnippetScreenShell
      onClose={onClose}
      index={cursor}
      total={total}
      onPrev={() => setCursor((c) => Math.max(c - 1, 0))}
      onNext={() => setCursor((c) => c + 1)}
      nextLabel={
        // FP-5 — flag when the next page is a re-read so the coach knows they're
        // moving from the spoken take into its corrected re-reads.
        session.snippets[cursor + 1]?.recordingKind === "read"
          ? "Next · re-read"
          : undefined
      }
      // FE-2 — the wrap-up reads as its own page: no "Next". Its actions (Open
      // the ideal text / Save / Publish) live in the page below.
      hideNext={isAtWrapup}
      managed={false}
      isCoachMessage={isAtWrapup}
    >
      {/* Snippet pages — all stay mounted for draft preservation. */}
      {session.snippets.map((s, i) => (
        <div key={s.id} className={i === cursor ? "flex flex-col gap-4 px-4 py-4" : "hidden"}>
          <CoachSnippetReviewCard
            sessionId={session.sessionId}
            snippet={s}
            index={i}
            total={session.snippets.length}
            presentationRef={session.presentationRef}
            initialState={draftCache?.snippets[s.id] ?? null}
            onStateChange={onSnippetSaved}
          />
        </div>
      ))}

      {/* Wrap-up page */}
      <div className={isAtWrapup ? "flex flex-col gap-4 px-4 py-4" : "hidden"}>
        <h2 className="text-[20px] font-semibold text-foreground">Wrap up</h2>

        {/* FE-8 — a non-blocking nudge, not a gate: saving with nothing
            surfaced is valid ("reviewed, nothing to surface"). */}
        {nothingSurfaced ? (
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-center text-[13px] text-muted-foreground">
            Nothing surfaced yet. You can still save; the user just won&apos;t
            get snippet feedback from this take.
          </p>
        ) : null}

        {/* FE-2 — the forward path, its own screen: Save this take, then Open
            the ideal text (review + approve), then Publish the full analysis.
            Each button shows its real, server-gated state from review-state. */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">
                Save this take
              </p>
              <p className="text-[12px] text-muted-foreground">
                Keeps your notes and labels for this recording.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSaveFeedback()}
              disabled={saving || publishing}
              className="shrink-0 rounded-full disabled:opacity-50"
            >
              {saving ? "Saving…" : savedFlash ? "Saved" : "Save feedback"}
            </Button>
          </div>

          {/* Open the ideal text — the primary action. Before take 3 (pending)
              or with nothing to assemble (empty), it's a cue, not a button. */}
          {reviewState?.ideal.assemblyState === "pending" ? (
            <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
              The ideal text assembles after take 3
              {reviewState.ideal.takesDone !== null
                ? `. ${reviewState.ideal.takesDone} of ${
                    reviewState.takesTarget ?? 3
                  } takes recorded so far.`
                : "."}
            </p>
          ) : reviewState?.ideal.assemblyState === "empty" ? (
            <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
              Nothing to assemble yet. Mark some key moments in the takes first.
            </p>
          ) : onOpenArcIdeal && session.arcId ? (
            <>
              <Button
                type="button"
                onClick={() => onOpenArcIdeal(session.arcId!)}
                className="h-11 w-full rounded-full bg-primary text-[14px] font-medium text-primary-foreground"
              >
                Open the ideal text
              </Button>
              {/* FE-8 — the founder's "Save ≠ approve" confusion: make the
                  approval step explicit while PUBLISH is still hidden. */}
              {reviewState && !reviewState.ideal.approved ? (
                <p className="text-center text-[12px] text-muted-foreground">
                  Review and Verify it there to unlock publishing.
                </p>
              ) : null}
            </>
          ) : (
            <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-center text-[13px] text-muted-foreground">
              Open the ideal text from the student&apos;s page to review and
              approve it.
            </p>
          )}

          {/* PUBLISH — the last button, only once the ideal text is approved. */}
          {reviewState?.ideal.approved ? (
            reviewState.published ? (
              <div className="flex items-center justify-center gap-1.5 rounded-full bg-success/10 py-2.5 text-[14px] font-medium text-success">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Delivered
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={!reviewState.canPublish || publishing}
                  className="h-11 w-full rounded-full bg-foreground text-[14px] font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
                >
                  {publishing ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  Publish the full analysis
                </Button>
                {!reviewState.canPublish && reviewState.blockers.length > 0 ? (
                  <p className="text-center text-[12px] text-muted-foreground">
                    {reviewState.blockers.map(blockerReason).join(" · ")}
                  </p>
                ) : null}
              </>
            )
          ) : null}
        </div>

        {publishError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-center text-[13px] text-destructive">
            {publishError}
          </p>
        ) : null}

        {session.feelings.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">
              Pre-recording state
              <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
                Coach only
              </span>
            </p>
            <ul className="flex flex-wrap gap-2">
              {session.feelings.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[13px] text-foreground"
                >
                  <FeelingBadge feeling={f} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

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

        <CoachVideoSlot
          sessionId={session.sessionId}
          videoRef={videoRef}
          onUploaded={(nextRef) => setVideoRef(nextRef)}
        />

        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">Re-cut snippets</p>
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
                  onClick={() => void handleRecut(true)}
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
                onClick={() => void handleRecut(false)}
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
                ? `${recutConfirm.labels} label${recutConfirm.labels === 1 ? "" : "s"} and ${recutConfirm.drafts} draft${recutConfirm.drafts === 1 ? "" : "s"}`
                : "the notes and labels you've added"}{" "}
              on this session.
            </p>
          ) : null}
          {recutError ? (
            <p className="mt-2 text-[12px] text-red-600">{recutError}</p>
          ) : null}
        </div>

        {/* A Save is a per-take checkpoint: nothing reaches the user until you
            Publish the full analysis above (which needs every take saved + the
            ideal text approved). */}
        <p className="text-center text-[12px] text-muted-foreground">
          Saving keeps this as your draft. The user receives everything at once
          when you publish the full analysis.
        </p>
      </div>
    </SnippetScreenShell>
  );
}

/* ── minimal fixed overlay for pre-shell states ── */

function PreShellOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 justify-end px-3 pt-3">
        <OverlayCloseButton onClick={onClose} />
      </div>
      <div className="flex flex-1 items-center justify-center px-8 text-center">
        {children}
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
