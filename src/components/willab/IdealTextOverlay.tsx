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
import IdealReadMic from "./IdealReadMic";

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
  onClose,
  onReadAloud,
}: {
  arcId: string;
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
    "loading" | "ready" | "instant" | "locked" | "pending" | "error"
  >("loading");
  const [ideal, setIdeal] = useState<IdealText | null>(null);
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
  // SD (single-deliverable) — the living-document state: verification status,
  // version, and whether the 5-credit moments unlock has run.
  const [sd, setSd] = useState<{
    status: "unverified" | "verified";
    version: number | null;
    momentsUnlocked: boolean;
    priceCredits: number | null;
    title: string | null;
    latestTakeSessionId: string | null;
    rereadDone: boolean;
  } | null>(null);
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
    void fetchIdealText(arcId).then((r) => {
      if (!active) return;
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
          title: r.title,
          latestTakeSessionId: r.latestTakeSessionId,
          rereadDone: r.rereadDone,
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
  }, [arcId, refetchNonce]);

  const displayText = notes ?? ideal?.text ?? "";

  // SD — the shared star layer owns the sheet, the Approve/Revert folds and
  // the 5-credit unlock. The notebook keeps only its legacy wrapper below.
  const stars = useMomentStars({
    arcId,
    momentsUnlocked: sd?.momentsUnlocked ?? false,
    priceCredits: sd?.priceCredits ?? null,
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
    if (!sd) {
      if (!m.snippetId) return;
      setMomentAsk(m);
      return;
    }
    await stars.openMoment(m);
  }

  function copyText() {
    void navigator.clipboard?.writeText(displayText).then(() => {
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
          {(status === "ready" || status === "instant") && !editing ? (
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
              <MomentStarText
                text={displayText}
                ideal={ideal}
                onMomentTap={(m) => void openMoment(m)}
                foldFor={stars.foldFor}
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
          <IdealReadMic
            arcId={arcId}
            version={sd.version}
            title={sd.title}
            latestTakeSessionId={sd.latestTakeSessionId}
            rereadDone={sd.rereadDone}
            onNewTake={() => onReadAloud(sd.version)}
            onReadUploaded={() => setRefetchNonce((n) => n + 1)}
          />
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

      {/* SD — the shared key-moment sheet (free playback → the suggestion to
          Approve, or the coach's message behind the 5-credit unlock). */}
      <MomentSheet
        moment={stars.momentOpen}
        momentContent={stars.momentContent}
        applied={stars.momentOpen ? stars.isApplied(stars.momentOpen) : false}
        onClose={stars.closeMoment}
        onApprove={() => stars.momentOpen && stars.approveMoment(stars.momentOpen)}
        onRevert={() => stars.momentOpen && stars.revertMoment(stars.momentOpen)}
        onBuy={stars.buyMoments}
        onReRecord={async (snippetId, takeSessionId, audio, durationSec) => {
          const r = await reRecordSnippet({
            snippetId,
            takeSessionId,
            topic: sd?.title ?? null,
            audio,
            durationSec,
          });
          // Re-pull the served text so the improved snippet + new version flow
          // in; the sheet stays open on its success confirmation.
          if (r.ok) setRefetchNonce((n) => n + 1);
          return r.ok;
        }}
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
