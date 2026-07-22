"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Lock, Mic, PencilLine, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import MediaPlayer from "@/components/results/MediaPlayer";
import OverlayCloseButton from "./OverlayCloseButton";
import LoadingState from "./LoadingState";
import PaywallPanel from "./PaywallPanel";
import FeedbackOverlay from "./FeedbackOverlay";
import { useBackDismiss } from "./useBackDismiss";
import { MarkerToolbar, RichText } from "./RichText";
import {
  MomentSheet,
  MomentStarText,
  useMomentStars,
  type LocalFold,
} from "./MomentStars";
import {
  fetchIdealText,
  isUnappliedPolish,
  saveIdealNotes,
  saveIdealUserEdit,
  segmentIdealText,
  type IdealKeyMomentLink,
  type DocumentSuggestion,
  type IdealPiece,
  type IdealText,
  type InstantPaywall,
  type MomentSuggestion,
} from "@/services/api/idealText";
import {
  fetchMomentExplanation,
  unlockMoments,
  type MomentExplanationResult,
} from "@/services/api/momentExplanation";
import { sendSuggestionFeedback } from "@/services/api/suggestionFeedback";
import { reRecordSnippet } from "@/services/api/reRecordSnippet";
import { swapPiece } from "@/services/api/pieceSwap";
import { PieceBadgeText, PieceSwapSheet } from "./PieceBadges";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import IdealReadMic from "./IdealReadMic";
import IdealTextActions from "./IdealTextActions";

/* -------------------------------------------------------------------------- */
/*  IdealTextOverlay — the user's ideal-text NOTEBOOK (delivery layer)         */
/*                                                                            */
/*  The purple bubble's destination: the coach-approved one-block ideal text   */
/*  in a big, clean reading view. Bolded openings (coach key phrases),         */
/*  underlined key moments — tapping one asks "Go to this moment?" and         */
/*  deep-links into the feedback page anchored at that moment. Copy + Edit;    */
/*  edits save to the user's PERSONAL copy (never the coach canonical — L1).   */
/*  Paywalled: locked (402) renders the unlock panel; pending = coach still    */
/*  working.                                                                   */
/* -------------------------------------------------------------------------- */

export default function IdealTextOverlay({
  arcId,
  version = null,
  onClose,
  onReadAloud,
}: {
  arcId: string;
  /** FE-3b — open an OLD version's read-only step (the GET's ?version form).
   *  null/absent → the live notebook. If the BE has no snapshot for it
   *  (historical_unavailable), the overlay falls back to the live view. */
  version?: number | null;
  onClose: () => void;
  /** SD — "Read it aloud": the host closes this overlay into the record flow
   *  for this presentation (a re-read is just another recording). Receives the
   *  current version as a take-count hint for the arc seed. Optional: without
   *  it the CTA hides. */
  onReadAloud?: (version: number | null) => void;
}) {
  // D-3 invariant — the device Back gesture closes THIS overlay (LIFO with the
  // nested FeedbackOverlay, which pushes its own entry on top).
  useBackDismiss(onClose);
  const [status, setStatus] = useState<
    "loading" | "ready" | "instant" | "locked" | "pending" | "error" | "historical"
  >("loading");
  const [ideal, setIdeal] = useState<IdealText | null>(null);
  // FE-3b — the frozen step being viewed (its version chip), and the fall-back
  // switch: historical_unavailable clears the requested version so the effect
  // refetches the live document, exactly the pre-FE-3b behavior.
  const [historical, setHistorical] = useState<{ version: number | null } | null>(
    null
  );
  const [requestedVersion, setRequestedVersion] = useState<number | null>(version);
  useEffect(() => {
    setRequestedVersion(version);
  }, [version, arcId]);
  // Instant lane — the payload's paywall figures for the upsell CTA.
  const [instantPaywall, setInstantPaywall] = useState<InstantPaywall | null>(
    null
  );
  // The user unlocked from THIS overlay (or the payload says they're already
  // entitled). The BE serves variant:"instant" for any unapproved arc, paid or
  // not — so after a successful unlock the refetch lands back on instant and,
  // without this flag, would re-show a "Buy" CTA for an arc the user just
  // bought (review R-i1). Unlocked → the upsell swaps to a confirmation.
  const [unlocked, setUnlocked] = useState(false);
  // The last instant draft, kept so a post-unlock refetch that maps to
  // "pending" (a BE serving instant strictly to unpaid arcs) doesn't make the
  // text the user was just reading vanish behind a bare pending line (R-i2).
  const lastInstantRef = useRef<{
    ideal: IdealText;
    paywall: InstantPaywall;
  } | null>(null);
  const unlockedRef = useRef(false);
  const [refetchNonce, setRefetchNonce] = useState(0);
  // Staleness fence for the GET (same rule as the readout, review R-db4).
  const fetchGenRef = useRef(0);
  // SD (single-deliverable) — the living-document state: verification status,
  // version, and whether the 5-credit moments unlock has run.
  const [sd, setSd] = useState<{
    status: "unverified" | "verified";
    version: number | null;
    momentsUnlocked: boolean;
    priceCredits: number | null;
    explanationsAvailable: boolean;
    title: string | null;
    latestTakeSessionId: string | null;
    rereadDone: boolean;
    pieces: IdealPiece[] | null;
    suggestions: DocumentSuggestion[] | null;
    saved: boolean | null;
  } | null>(null);
  // DISCERNMENT — the pending-swap comparison sheet's open piece.
  const [swapOpen, setSwapOpen] = useState<IdealPiece | null>(null);
  // A different arc = a fresh entitlement question; never carry the unlocked
  // flag or a cached draft across arcs.
  useEffect(() => {
    unlockedRef.current = false;
    lastInstantRef.current = null;
    setUnlocked(false);
    stars.resetFolds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arcId]);

  // Notebook state: the personal copy wins for display once saved.
  const [notes, setNotes] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // The tapped key moment awaiting "Go to this moment?" confirmation.
  const [momentAsk, setMomentAsk] = useState<IdealKeyMomentLink | null>(null);
  // The open feedback deep-link (stacked over this overlay).
  const [feedbackTarget, setFeedbackTarget] =
    useState<IdealKeyMomentLink | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setHistorical(null);
    const gen = ++fetchGenRef.current;
    void fetchIdealText(arcId, requestedVersion).then((r) => {
      if (!active || gen !== fetchGenRef.current) return;
      if (r.kind === "historical") {
        // FE-3b — a frozen step: that version's text + that version's
        // reasoning, read-only. No SD chrome, no editing, no paywall.
        setIdeal(r.ideal);
        setNotes(null);
        setSd(null);
        setHistorical({ version: r.version });
        setStatus("historical");
        return;
      }
      if (r.kind === "historicalUnavailable") {
        // No snapshot for that version (pre-history arc) — fall back to the
        // live notebook, exactly as bubbles behaved before FE-3b.
        setRequestedVersion(null);
        return;
      }
      if (r.kind === "single") {
        // SD — the ONE living text: both statuses free to read; the only paid
        // thing is opening the key moments. Renders through the ready view
        // with the SD chrome (status chip, read-aloud CTA, moment behavior).
        setIdeal(r.ideal);
        setNotes(null);
        setSd({
          status: r.status,
          version: r.version,
          momentsUnlocked: r.momentsUnlocked,
          priceCredits: r.priceCredits,
          explanationsAvailable: r.explanationsAvailable,
          title: r.title,
          latestTakeSessionId: r.latestTakeSessionId,
          rereadDone: r.rereadDone,
          pieces: r.pieces,
          suggestions: r.suggestions,
          saved: r.saved,
        });
        setStatus("ready");
      } else if (r.kind === "ready") {
        setIdeal(r.ideal);
        setNotes(r.ideal.notes);
        setStatus("ready");
      } else if (r.kind === "instant") {
        // The free machine draft — same reading view, plus the polishing
        // banner + upsell; no personal-notes editing (perfected-lane feature).
        setIdeal(r.ideal);
        setNotes(null);
        setInstantPaywall(r.paywall);
        lastInstantRef.current = { ideal: r.ideal, paywall: r.paywall };
        if (r.entitled) {
          unlockedRef.current = true;
          setUnlocked(true);
        }
        setStatus("instant");
      } else if (
        r.kind === "pending" &&
        unlockedRef.current &&
        lastInstantRef.current
      ) {
        // R-i2 — the user just unlocked and the BE stopped serving the instant
        // draft (a strictly-unpaid instant lane). Keep showing the draft they
        // were reading, with the unlocked confirmation, instead of swapping
        // paid-for content for a bare pending line.
        setIdeal(lastInstantRef.current.ideal);
        setNotes(null);
        setInstantPaywall(lastInstantRef.current.paywall);
        setStatus("instant");
      } else {
        setStatus(r.kind);
      }
    });
    return () => {
      active = false;
    };
  }, [arcId, refetchNonce, requestedVersion]);

  const displayText = notes ?? ideal?.text ?? "";

  // FE-3/4/5 — a tracked-change decision. Accept = the proposal becomes the
  // text; Keep mine = the suggestion is refused and never re-offered. Both
  // ride the existing per-snippet feedback POST (the ledger remembers them).
  const decideTracked = async (
    s: DocumentSuggestion,
    d: "accept" | "keep"
  ): Promise<boolean> => {
    // Without the snippet+session pair the ledger has nothing to key on —
    // refuse rather than pretend the decision was saved.
    if (!s.snippetId || !s.takeSessionId) return false;
    const r = await sendSuggestionFeedback({
      snippetId: s.snippetId,
      sessionId: s.takeSessionId,
      target: s.kind === "bold" ? "document_bold" : "document_replace",
      action: d === "accept" ? "applied" : "dismissed",
      suggestionId: s.id,
    });
    if (!r.saved) return false;
    setSd((prev) =>
      prev
        ? {
            ...prev,
            suggestions: (prev.suggestions ?? []).map((x) =>
              x.id === s.id
                ? { ...x, status: d === "accept" ? "approved" : "dismissed" }
                : x
            ),
          }
        : prev
    );
    // An accept reassembles the document BE-side (version bump) — pull it.
    if (d === "accept") {
      fetchGenRef.current++; // fence any in-flight pre-decision GET
      setRefetchNonce((n) => n + 1);
    }
    return true;
  };

  // SD — the shared star layer owns the sheet, the Approve/Revert folds and
  // the 5-credit unlock. The notebook keeps only its legacy wrapper below.
  const stars = useMomentStars({
    arcId,
    momentsUnlocked: sd?.momentsUnlocked ?? false,
    priceCredits: sd?.priceCredits ?? null,
    explanationsAvailable: sd?.explanationsAvailable ?? false,
    onUnlocked: () =>
      setSd((prev) => (prev ? { ...prev, momentsUnlocked: true } : prev)),
  });

  // FE-2 — polish stars on this text, and the ones still awaiting a decision.
  const allPolish = useMemo(
    () => (ideal?.keyMoments ?? []).filter(isUnappliedPolish),
    [ideal]
  );
  const pendingPolish = useMemo(
    () => allPolish.filter((m) => !stars.isApplied(m)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPolish, stars.appliedLocal]
  );

  // Legacy (non-SD) lane keeps the "Go to this moment?" confirm bubble; a
  // legacy moment with no snippet link stays inert (it has nowhere to
  // deep-link — R-sd4). Under SD every tap goes to the shared sheet.
  async function openMoment(m: IdealKeyMomentLink) {
    // FE-3b — historical steps use the shared sheet too (read-only): a
    // suggestion star opens its reasoning, a plain moment gets the honest
    // no-explanation line. Never the legacy "Go to this moment?" confirm.
    if (status === "historical") {
      await stars.openMoment(m);
      return;
    }
    if (!sd) {
      if (!m.snippetId) return;
      setMomentAsk(m);
      return;
    }
    await stars.openMoment(m);
  }

  function copyText() {
    void navigator.clipboard?.writeText(stripRichMarkers(displayText)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/70 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-medium text-foreground">
          Your ideal text
        </span>
        <div className="flex items-center gap-1.5">
          {(status === "ready" || status === "instant" || status === "historical") &&
          !editing ? (
            <button
              type="button"
              onClick={copyText}
              aria-label={copied ? "Copied" : "Copy the text"}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : null}
          {/* Personal-notes editing is a legacy perfected-lane feature — no
              pencil on the instant draft or in the SD living document. */}
          {status === "ready" && !editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit your copy"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PencilLine className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <OverlayCloseButton onClick={onClose} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 py-8">
          {status === "loading" ? (
            <LoadingState />
          ) : status === "locked" ? (
            <PaywallPanel
              arcId={arcId}
              onUnlocked={() => setRefetchNonce((n) => n + 1)}
            />
          ) : status === "pending" ? (
            <p className="py-16 text-center text-[15px] leading-relaxed text-muted-foreground">
              Your coach is still shaping your ideal text. It lands here the
              moment it&apos;s approved.
            </p>
          ) : status === "historical" && ideal ? (
            // FE-3b — the read-only step view: the frozen text with that
            // version's stars (their reasoning opens in the read-only sheet).
            // No editing, no bulk controls, no read-aloud, no paywall.
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                {historical?.version !== null &&
                historical?.version !== undefined ? (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[12px] font-medium tabular-nums text-muted-foreground">
                    {historical.version}.0
                  </span>
                ) : null}
                <span className="rounded-full bg-muted px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
                  Earlier version, read-only
                </span>
              </div>
              <MomentStarText
                text={ideal.text}
                ideal={ideal}
                onMomentTap={(m) => void openMoment(m)}
                sdStars
              />
            </div>
          ) : status === "error" ? (
            <p className="py-16 text-center text-[15px] leading-relaxed text-muted-foreground">
              Couldn&apos;t load your ideal text. Try again in a moment.
            </p>
          ) : status === "instant" && ideal ? (
            <div className="flex flex-col gap-5">
              {/* The persistent instant banner — this text is a DRAFT the
                  machine assembled; the coach-perfected version replaces it
                  on this same screen once approved + unlocked. */}
              <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <p className="text-[13px] leading-relaxed text-foreground">
                  Instant draft. Your coach is polishing the full version.
                </p>
              </div>
              {/* No bulk control in the INSTANT lane: this view renders
                  MomentStarText without foldFor, so an approval would record
                  server-side while changing nothing on screen (review R-p6).
                  The SD lane below owns it. */}
              <MomentStarText
                text={displayText}
                ideal={ideal}
                onMomentTap={setMomentAsk}
              />
              {/* The upsell — same unlock seam as the hard paywall, with the
                  payload's figures and instant-specific lead copy. Once
                  unlocked (here, or already entitled per the payload), the Buy
                  CTA must never re-show for this arc: the perfected text just
                  isn't approved yet, which is the coach's timeline, not a
                  payment problem (review R-i1). */}
              {unlocked ? (
                <div className="flex items-center gap-2 rounded-2xl border border-success/40 bg-success/5 px-4 py-3">
                  <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
                  <p className="text-[13px] leading-relaxed text-foreground">
                    Full analysis unlocked. The coach-perfected version lands
                    here as soon as your coach approves it.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card">
                  <PaywallPanel
                    arcId={arcId}
                    onUnlocked={() => {
                      unlockedRef.current = true;
                      setUnlocked(true);
                      setRefetchNonce((n) => n + 1);
                    }}
                    lead="Want the coach-perfected version? Unlock the full analysis."
                    priceCredits={instantPaywall?.priceCredits ?? null}
                    creditsCurrent={instantPaywall?.creditsCurrent ?? null}
                  />
                </div>
              )}
            </div>
          ) : editing && ideal ? (
            <NotebookEditor
              arcId={arcId}
              initial={displayText}
              // #214 — SD edits persist through the user-edit PUT (the
              // student's edit always wins; supersede retried inside the
              // service). Legacy mode keeps the personal-notes PUT.
              save={
                sd
                  ? async (t: string) =>
                      (await saveIdealUserEdit(arcId, t, sd.version)).ok
                  : undefined
              }
              onSaved={(text) => {
                if (sd) {
                  setIdeal((prev) => (prev ? { ...prev, text } : prev));
                } else {
                  setNotes(text);
                }
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : ideal ? (
            <div className="flex flex-col gap-4">
              {/* SD chrome — the living document's status + the read-aloud ask. */}
              {sd ? (
                <div className="flex flex-col gap-3">
                  <span
                    className={`self-start rounded-full px-2.5 py-1 text-[12px] font-medium ${
                      sd.status === "verified"
                        ? "bg-success/10 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {sd.status === "verified"
                      ? "Verified"
                      : "Pending verification by the coach"}
                  </span>
                </div>
              ) : null}
              {/* FE-2 — one tap applies every smoother-version suggestion.
                  Polish only; acoustic and structural stars stay per-star. */}
              {sd && stars.bulkApplied ? (
                <button
                  type="button"
                  onClick={() => stars.revertAllPolish(allPolish)}
                  className="self-start text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Undo all
                </button>
              ) : sd && pendingPolish.length >= 2 ? (
                <button
                  type="button"
                  onClick={() => stars.approveAllPolish(pendingPolish)}
                  className="self-start rounded-full border border-border px-3.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Approve all
                </button>
              ) : null}
              <PieceBadgeText
                text={displayText}
                ideal={ideal}
                // DISCERNMENT — SD only; a legacy payload has pieces null and
                // renders exactly today's view.
                // MASTER DOCUMENT — a saved version shows the clean script.
                pieces={sd?.saved === true ? null : sd?.pieces ?? null}
                // LIVING TRANSCRIPT — tracked changes own the words when the
                // BE serves them; the version pills compose on top.
                suggestions={sd?.suggestions ?? null}
                onDecideTracked={decideTracked}
                onMomentTap={(m) => void openMoment(m)}
                foldFor={stars.foldFor}
                // FE-2 — the star treatment only under SD (a legacy "ready"
                // payload keeps its classic underline links).
                sdStars={sd !== null}
                onOpenSwap={setSwapOpen}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* "Go to this moment?" — the small confirm bubble for a tapped moment. */}
      {momentAsk ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-10 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
            <p className="text-[14px] text-foreground">Go to this moment?</p>
            <Button
              type="button"
              onClick={() => {
                setFeedbackTarget(momentAsk);
                setMomentAsk(null);
              }}
              className="h-8 rounded-full bg-foreground px-4 text-[13px] text-background hover:bg-foreground/90"
            >
              Go
            </Button>
            <button
              type="button"
              onClick={() => setMomentAsk(null)}
              className="text-[13px] text-muted-foreground hover:text-foreground"
            >
              Stay
            </button>
          </div>
        </div>
      ) : null}

      {/* FE-3 — the re-read mic as a PERSISTENT bottom control (it used to be
          a card buried in the header chrome). Reading the corrected text aloud
          is the next take, and it is the main way this text keeps improving. */}
      {status === "ready" && !editing && sd && onReadAloud ? (
        // FE-D — the ONE two-state mic: an in-place read of the ideal text, or
        // "Record another take" once this version has been read.
        <div className="shrink-0 bg-background px-4 pb-4">
          {sd.saved !== null ? (
            // MASTER DOCUMENT (FE-3) — Save → re-read (gated) → next take.
            <IdealTextActions
              arcId={arcId}
              version={sd.version}
              title={sd.title}
              latestTakeSessionId={sd.latestTakeSessionId}
              rereadDone={sd.rereadDone}
              saved={sd.saved}
              onSaved={() => setRefetchNonce((n) => n + 1)}
              onNewTake={() => onReadAloud(sd.version)}
              onReadUploaded={() => setRefetchNonce((n) => n + 1)}
            />
          ) : (
            <IdealReadMic
              arcId={arcId}
              version={sd.version}
              title={sd.title}
              latestTakeSessionId={sd.latestTakeSessionId}
              rereadDone={sd.rereadDone}
              onNewTake={() => onReadAloud(sd.version)}
              onReadUploaded={() => setRefetchNonce((n) => n + 1)}
            />
          )}
        </div>
      ) : null}

      {/* The deep-linked feedback page, stacked over the notebook. */}
      {feedbackTarget ? (
        <FeedbackOverlay
          arcId={arcId}
          takeSessionId={feedbackTarget.takeSessionId || null}
          anchorSnippetId={feedbackTarget.snippetId}
          onClose={() => setFeedbackTarget(null)}
          topLayer
        />
      ) : null}

      {/* DISCERNMENT — accept lands the challenger (BE reassembles → full
          refetch); reject pins the incumbent (apply the echoed piece, the
          glow dies). Both 409s refetch SILENTLY — never an error surface. */}
      <PieceSwapSheet
        piece={swapOpen}
        onClose={() => setSwapOpen(null)}
        onDecide={async (action) => {
          const p = swapOpen;
          if (!p?.challenger) return false;
          const r = await swapPiece({
            arcId,
            pieceKey: p.pieceKey,
            action,
            challengerSnippetId: p.challenger.snippetId,
          });
          if (r.kind === "error") return false;
          setSwapOpen(null);
          if (r.kind === "stale" || action === "accept" || r.piece === null) {
            setRefetchNonce((n) => n + 1);
          } else {
            const echoed = r.piece;
            fetchGenRef.current++; // fence out any in-flight pre-decision GET
            setSd((prev) =>
              prev
                ? {
                    ...prev,
                    pieces: (prev.pieces ?? []).map((x) =>
                      x.pieceKey === echoed.pieceKey ? echoed : x
                    ),
                  }
                : prev
            );
          }
          return true;
        }}
      />
      {/* SD — the shared key-moment sheet (free playback → the suggestion to
          Approve, or the coach's message behind the 5-credit unlock). */}
      <MomentSheet
        moment={stars.momentOpen}
        momentContent={stars.momentContent}
        applied={stars.momentOpen ? stars.isApplied(stars.momentOpen) : false}
        // FE-3b — a historical step's sheet is a record: reasoning without
        // Approve, and no re-record mic (a mic here would record against a
        // superseded version's snippet).
        readOnly={status === "historical"}
        onClose={stars.closeMoment}
        onApprove={() => stars.momentOpen && stars.approveMoment(stars.momentOpen)}
        onRevert={() => stars.momentOpen && stars.revertMoment(stars.momentOpen)}
        onBuy={stars.buyMoments}
        onReRecord={
          status === "historical"
            ? undefined
            : async (snippetId, takeSessionId, audio, durationSec) => {
                const r = await reRecordSnippet({
                  snippetId,
                  takeSessionId,
                  topic: sd?.title ?? null,
                  audio,
                  durationSec,
                });
                // Re-pull the served text so the improved snippet + new version
                // flow in; the sheet stays open on its success confirmation.
                if (r.ok) setRefetchNonce((n) => n + 1);
                return r.ok;
              }
        }
      />
    </div>
  );
}

function NotebookEditor({
  arcId,
  initial,
  save: saveOverride,
  onSaved,
  onCancel,
}: {
  arcId: string;
  initial: string;
  /** #214 — optional persistence override (the SD user-edit PUT); default is
   *  the legacy personal-notes PUT. Returns success. */
  save?: (text: string) => Promise<boolean>;
  onSaved: (text: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  // An emptied draft can't save: the mapper reads an empty stored copy as
  // "no personal copy" on the next load, so it would silently revert to the
  // canonical — blocking it here keeps what you see and what persists aligned.
  const empty = draft.trim() === "";

  async function save() {
    if (saving || empty) return;
    setSaving(true);
    setError(null);
    const ok = saveOverride
      ? await saveOverride(draft)
      : await saveIdealNotes(arcId, draft);
    setSaving(false);
    if (ok) onSaved(draft);
    else setError("Couldn't save. Try again.");
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Bold / underline / italic / orange — the same shared toolbar the coach
          gets; wraps the selection in the pinned marker contract. */}
      <MarkerToolbar textareaRef={ref} value={draft} onChange={setDraft} />
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="min-h-[50vh] w-full flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-4 text-[18px] leading-relaxed outline-none focus:border-primary"
      />
      <p className="text-[12px] text-muted-foreground">
        {saveOverride
          ? "Your edit becomes the text. Your coach sees it too."
          : "This is your personal copy. The coach-approved original stays unchanged."}
      </p>
      <div className="flex items-center gap-2">
        {/* FE-5 (bug 3b) — no "Save" CTA: the text is already saved and an
            edit persists on exiting edit mode, so "Save" would promise
            something that already happened. "Done" persists and closes; Cancel
            discards. */}
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving || empty}
          className="h-10 rounded-full bg-foreground px-6 text-[14px] text-background hover:bg-foreground/90"
        >
          {saving ? "Saving…" : "Done"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-10 rounded-full px-6 text-[14px]"
        >
          Cancel
        </Button>
        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
