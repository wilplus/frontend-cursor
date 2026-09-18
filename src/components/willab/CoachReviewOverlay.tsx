"use client";

import { useCallback, useEffect, useState } from "react";
import LoadingState from "./LoadingState";
import OverlayCloseButton from "./OverlayCloseButton";
import { Button } from "@/components/ui/button";
import { useCoachReview } from "./useCoachReview";
import CoachSnippetReviewCard from "./CoachSnippetReviewCard";
import { CoachEyebrow } from "./coachChrome";
import { useBackDismiss } from "./useBackDismiss";
import SnippetScreenShell from "./SnippetScreenShell";
import CoachJudgementQueue from "./CoachJudgementQueue";
import { recutSession } from "@/services/api/recutSession";
import type {
  CoachReviewSession,
  CoachSnippetState,
  SessionFeeling,
} from "@/services/api/coachReview";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import {
  readCoachReviewDraft,
  writeCoachReviewDraft,
} from "@/lib/willab/coachReviewDraft";

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
  const takeLabel =
    feeling.takeIndex != null ? ` · Take ${feeling.takeIndex}` : "";
  return (
    <span>
      {emoji} {label}
      {takeLabel}
    </span>
  );
}

/** The take's own tail: what belongs to THIS recording and nothing else.
 *
 *  Delivery left this screen on 2026-09-18. Save, the overall message, the
 *  coach video, the ideal-text cue and PUBLISH now live in
 *  CoachDeliveryOverlay, one action per screen, because the student receives
 *  ONE analysis for the whole arc — a per-take wrap-up was the wrong place to
 *  decide an arc-level delivery from, and it hid the publish button until the
 *  ideal text was approved, which taught the coach a gate the server does not
 *  have. Saving is automatic now: the drafts this overlay mirrors to
 *  localStorage are flushed when the coach leaves the Feedbacks review
 *  (flushCoachReviewDrafts). */
function renderCoachReviewWrapupPage(options: {
  isAtWrapup: boolean;
  session: CoachReviewSession;
  recutConfirm: { drafts: number } | null;
  setRecutConfirm: (value: { drafts: number } | null) => void;
  recutting: boolean;
  recutError: string | null;
  onRecut: (force: boolean) => void;
}): React.ReactNode {
  const {
    isAtWrapup,
    session,
    recutConfirm,
    setRecutConfirm,
    recutting,
    recutError,
    onRecut,
  } = options;
  return (
    <div className={isAtWrapup ? "flex flex-col gap-4 px-4 py-4" : "hidden"}>
      <h2 className="text-[20px] font-semibold text-foreground">
        End of this take
      </h2>

      {session.feelings.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13.5px] font-semibold text-foreground">
            Pre-recording state
            <CoachEyebrow className="ml-2">Coach only</CoachEyebrow>
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

      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-foreground">
            Re-cut snippets
          </p>
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
                onClick={() => onRecut(true)}
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
              onClick={() => onRecut(false)}
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
            {recutConfirm.drafts > 0
              ? `${recutConfirm.drafts} saved review item${recutConfirm.drafts === 1 ? "" : "s"}`
              : "the coach notes you've added"}{" "}
            on this session.
          </p>
        ) : null}
        {recutError ? (
          <p className="mt-2 text-[12px] text-red-600">{recutError}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function CoachReviewOverlay({
  sessionId,
  onClose,
  initialPiece = null,
  completeLabel,
  onQueueComplete,
}: {
  sessionId: string;
  onClose: () => void;
  /** 1-based piece to resume the judgement queue on (from ?piece=). Out of
   *  range is clamped once the session loads rather than opening on nothing. */
  initialPiece?: number | null;
  /** What the judgement queue's last action says once every piece is answered
   *  — "Judge take 2", "On to the feedback". The hub owns the walk, so it owns
   *  the wording; without it the queue simply closes. */
  completeLabel?: string;
  onQueueComplete?: () => void;
}) {
  useBackDismiss(onClose);
  const { status, session, refresh } = useCoachReview(sessionId);

  // R4-8 — crash-safety draft, read ONCE synchronously at mount so the snippet
  // cards can seed from it (they mount as soon as the session loads). Holds an
  // unpublished review that a closed tab would otherwise have lost.
  const [draftCache] = useState(() => readCoachReviewDraft(sessionId));
  const [localState, setLocalState] = useState<
    Record<string, CoachSnippetState>
  >(() => draftCache?.snippets ?? {});
  const [cursor, setCursor] = useState(() =>
    initialPiece && initialPiece > 0 ? initialPiece - 1 : 0,
  );
  const [recutting, setRecutting] = useState(false);
  const [recutError, setRecutError] = useState<string | null>(null);
  const [recutConfirm, setRecutConfirm] = useState<{
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
      setRecutConfirm({ drafts: result.drafts });
    } else {
      setRecutError(result.message);
    }
    setRecutting(false);
  }

  // Clamp a resume position the session turns out not to have (a re-cut can
  // shorten the queue between leaving for the CMS and coming back).
  useEffect(() => {
    if (!session) return;
    setCursor((c) => Math.min(c, Math.max(session.snippets.length - 1, 0)));
  }, [session]);

  const onSnippetSaved = useCallback(
    (snippetId: string, next: CoachSnippetState) => {
      setLocalState((prev) => ({ ...prev, [snippetId]: next }));
    },
    [],
  );
  /** An answer carries the queue forward on its own — except a Yes or a No,
   *  which reveal the words and the exercise link. Advancing past those would
   *  hide both, so they hold the screen and Next becomes a tap. */
  const onBlindRatingCommitted = useCallback(
    (value: ConfidenceRatingValue | null) => {
      void refresh();
      if (value === "yes" || value === "no") return;
      window.setTimeout(() => {
        setCursor((c) => c + 1);
      }, 420);
    },
    [refresh],
  );

  /** The CMS owns exercise authoring; the review only hands off and comes
   *  back. `returnTo` carries the exact piece so the queue reopens where the
   *  coach left it — the drafts survive the trip in localStorage already. */
  const onBuildExercise = useCallback(() => {
    const back = `/chat?review=${encodeURIComponent(sessionId)}&piece=${cursor + 1}`;
    window.location.assign(
      `/cms/new/exercise/1?returnTo=${encodeURIComponent(back)}`,
    );
  }, [sessionId, cursor]);

  // R4-8 — mirror the in-progress review to localStorage (debounced). It was
  // crash insurance; since 2026-09-18 it is also the SOURCE of the automatic
  // save: leaving the Feedbacks review flushes these drafts to the server
  // (flushCoachReviewDrafts), so what the coach last saw is what persists.
  useEffect(() => {
    if (!session) return;
    const id = setTimeout(() => {
      writeCoachReviewDraft(sessionId, session.overallMessage, localState);
    }, 400);
    return () => clearTimeout(id);
  }, [sessionId, session, localState]);

  // Pre-shell states (loading / error / no snippets yet).
  if (status === "loading" || !session) {
    return (
      <PreShellOverlay onClose={onClose}>
        {status === "loading" ? (
          <LoadingState placement="surface" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
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

  const total = session.snippets.length + (session.contextUnlocked ? 1 : 0);
  const isAtWrapup =
    session.contextUnlocked && cursor === session.snippets.length;

  /* ── PASS ONE: the judgement queue ──────────────────────────────────────
     Its own chrome, shared with every other blind pass (CoachJudgementQueue):
     one piece per screen, progress dots, Back / Next. It is NOT the slide
     shell — there is no slide in a blind pass, and that shell's floating
     controls sit on a dark gradient meant to dim one.

     The hard fence is unchanged and still structural: this branch returns
     before any slide, note, surface toggle or practice control is
     CONSTRUCTED, and the backend redacts the same fields independently. */
  if (!session.contextUnlocked) {
    const current = session.snippets[cursor];
    const answeredHere = (s: (typeof session.snippets)[number]) => {
      const st = localState[s.id] ?? s.coachState;
      return st.ratingValue !== null || st.ratingUnrateable;
    };
    const last = cursor >= session.snippets.length - 1;
    const allAnswered = session.snippets.every(answeredHere);
    return (
      <CoachJudgementQueue
        title={session.topic || session.pseudonym || "Judgement"}
        eyebrow="Coach only · training"
        items={session.snippets.map((s) => ({
          id: s.id,
          answered: answeredHere(s),
        }))}
        index={cursor}
        onJump={setCursor}
        onBack={() => setCursor((c) => Math.max(c - 1, 0))}
        onClose={onClose}
        forward={
          last
            ? allAnswered
              ? {
                  label: completeLabel ?? "Done",
                  onClick: onQueueComplete ?? onClose,
                  tone: "primary" as const,
                }
              : undefined
            : {
                label: current && answeredHere(current) ? "Next" : "Skip",
                onClick: () =>
                  setCursor((c) => Math.min(session.snippets.length - 1, c + 1)),
                tone:
                  current && answeredHere(current)
                    ? ("primary" as const)
                    : ("quiet" as const),
              }
        }
      >
        {session.snippets.map((s, i) => (
          <div key={s.id} className={i === cursor ? "" : "hidden"}>
            <CoachSnippetReviewCard
              sessionId={session.sessionId}
              snippet={s}
              index={i}
              total={session.snippets.length}
              presentationRef={session.presentationRef}
              slides={session.slides}
              contextUnlocked={false}
              onBlindRatingCommitted={onBlindRatingCommitted}
              onBuildExercise={onBuildExercise}
              initialState={draftCache?.snippets[s.id] ?? null}
              onStateChange={onSnippetSaved}
            />
          </div>
        ))}
      </CoachJudgementQueue>
    );
  }

  /* ── PASS TWO: the contextual walk, which does have slides ─────────────── */
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
      // The take's tail reads as its own page: no "Next".
      hideNext={isAtWrapup}
      managed={false}
      // The floating indicator + ✕ + their gradient belong over a slide. The
      // tail has none, and neither does a snippet the deck never mapped.
      hasSlideBehind={!isAtWrapup && Boolean(session.snippets[cursor]?.slide)}
    >
      {/* Snippet pages — all stay mounted for draft preservation. */}
      {session.snippets.map((s, i) => (
        <div
          key={`${s.id}:context`}
          className={i === cursor ? "flex flex-col gap-4 px-4 py-4" : "hidden"}
        >
          <CoachSnippetReviewCard
            sessionId={session.sessionId}
            snippet={s}
            index={i}
            total={session.snippets.length}
            presentationRef={session.presentationRef}
            slides={session.slides}
            contextUnlocked
            onBlindRatingCommitted={onBlindRatingCommitted}
            initialState={draftCache?.snippets[s.id] ?? null}
            onStateChange={onSnippetSaved}
          />
        </div>
      ))}

      {/* The take's own tail — delivery lives in CoachDeliveryOverlay now. */}
      {renderCoachReviewWrapupPage({
        isAtWrapup,
        session,
        recutConfirm,
        setRecutConfirm,
        recutting,
        recutError,
        onRecut: (force) => void handleRecut(force),
      })}
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
