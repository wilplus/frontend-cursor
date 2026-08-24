"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Sparkles } from "lucide-react";
import { VoiceMark } from "./LoadingState";
import MediaPlayer from "@/components/results/MediaPlayer";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import {
  CoachCard,
  CoachChip,
  CoachErrorLine,
  CoachEyebrow,
  CoachMetaPill,
} from "./coachChrome";
import {
  buildVerdictBody,
  correctionOptions,
  effectiveReplacement,
  effectiveWhy,
  fetchCoachArcStars,
  humanizeToken,
  NOTE_MAX_CHARS,
  saveStarVerdict,
  starChipLabel,
  starRowKey,
  type ArcStar,
  type StarVerdict,
} from "@/services/api/starVerdicts";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  fetchCoachReviewState,
  type CoachReviewState,
  type PublishAdvisory,
  type PublishBlocker,
} from "@/services/api/coachReviewState";
import { countAwaitingReview, orderTakesForReview } from "./takeReviewOrder";
import {
  AUTOSAVE_DEBOUNCE_MS,
  shouldAutosaveDraft,
} from "@/lib/willab/autosaveDrafts";
import { publishArc } from "@/services/api/arcBatch";
import {
  fetchConfidenceQueue,
  type QueuePiece,
} from "@/services/api/trainingCorpus";
import {
  buildRatingBody,
  saveStateRating,
  type TernaryValue,
} from "@/services/api/stateRatings";
import ConfidenceLabelChips from "./ConfidenceLabelChips";

/* -------------------------------------------------------------------------- */
/*  CoachStarVerdictOverlay — FEEDBACKS REVIEW: the coach's one scrollable     */
/*  panel (founder 2026-08-10, second decision — supersedes the Lab shape).    */
/*                                                                            */
/*  The founder's correction, verbatim intent: "just two screens - the        */
/*  scrollable feedbacks review and the training corpus review." So:           */
/*                                                                            */
/*    * ONE state, no toggle. The Live/Uploaded two-state head shipped         */
/*      earlier the same day and was removed on the founder's word ("any      */
/*      toggle should be removed").                                            */
/*    * The confident-voice stars live IN here (the strip below), not in a     */
/*      separate review panel.                                                 */
/*    * The training corpus stays in the hamburger menu ONLY — the in-panel    */
/*      link is deleted ("delete the training corpus link"). That flow labels  */
/*      BLIND, and this panel shows the machine's guesses; the menu is the     */
/*      one way in (N1/N4).                                                    */
/*                                                                            */
/*  For every star the system fired on this arc: Keep / Wrong kind… /          */
/*  Shouldn't fire. The verdicts are the training corpus that teaches the      */
/*  system when to speak and when to stay quiet. This is a review, not         */
/*  moderation — a verdict changes NOTHING the student sees (N2): the star     */
/*  still renders for them exactly as before, including on a should_not_fire.  */
/*                                                                            */
/*  N1 / BLIND COACH — this surface SHOWS the machine's guess, so it must      */
/*  never sit in or link from the blind labeling flow (CoachReviewOverlay /    */
/*  CoachSnippetReviewCard, where the coach labels direction blind). It is a   */
/*  separate overlay with its own entry on the student-detail screen, mounted  */
/*  as a Lounge sibling; starVerdictSeparation.test.ts enforces the import     */
/*  graph in both directions. Do not add an entry to the review wrap-up —      */
/*  that page is part of the labeling flow.                                    */
/*                                                                            */
/*  N3 — "Wrong kind" is never submittable bare: the pill only opens the       */
/*  picker, and the PICK is the save. N5 — a saved verdict renders as the      */
/*  active pill, re-tappable; re-judging upserts. Rows render in payload       */
/*  order (server-side: unjudged first, then by family) — never re-sorted.     */
/*                                                                            */
/*  State is keyed by this overlay instance, which is keyed by arc: closing    */
/*  drops everything, so verdicts are never cached across arcs by snippet id   */
/*  alone (snippet ids are global, but the review context is the arc).         */
/*                                                                            */
/*  Coach-only surface; BE enforces require_admin_or_coach. Copy on this       */
/*  screen is coach-facing (LIVE LOOP: flagged for founder sign-off).          */
/* -------------------------------------------------------------------------- */

/** The Confident Voice star family, in EITHER trigger vocabulary.
 *
 *  The 2026-08-13 re-point retired the charisma construct and renamed the
 *  persisted trigger `charisma` → `confident`. Rows written before that date
 *  keep the word they were written with — detector definitions are versioned,
 *  never backfilled — so a reader that knew only the new string would quietly
 *  demote every historical star. Mirrors `CONFIDENT_VOICE_TRIGGERS` in the
 *  backend's services/intervention_candidates.py. */
const CONFIDENT_VOICE_TRIGGERS = ["confident", "charisma"];

function isConfidentVoice(star: { trigger?: string | null }): boolean {
  return CONFIDENT_VOICE_TRIGGERS.includes(star.trigger ?? "");
}

/** Map a publish blocker to the disabled-PUBLISH reason. DUPLICATED from the
 *  review walker on purpose: importing it would put a blind-labeler file on
 *  this panel's import graph (N1), and a couple of strings are cheaper than a
 *  breached fence. Keep the wording identical to the walker's. */
function blockerReason(b: PublishBlocker): string {
  switch (b) {
    case "NO_TAKES":
      return "No recordings to publish yet";
  }
}

/** What a publish RIGHT NOW would leave out. Never disables anything
 *  (founder 2026-08-14: "post it when I want, even with a single feedback") —
 *  it says what will be skipped so the choice is informed rather than
 *  blocked. Skipped takes stay visibly "to review". */
function advisoryNote(a: PublishAdvisory): string {
  switch (a) {
    case "TAKES_NOT_SAVED":
      return "Takes you haven't reviewed will stay unreviewed";
    case "IDEAL_TEXT_NOT_APPROVED":
      return "The ideal text isn't verified yet";
    case "NO_FEEDBACK":
      return "Add a note to at least one moment to publish";
  }
}

export default function CoachStarVerdictOverlay({
  arcId,
  sessionIds,
  onOpenTakeReview,
  onClose,
}: {
  arcId: string;
  /** The arc's take sessions — the confident-voice labeling rows at the top
   *  of the list aggregate each session's blind queue (founder 2026-08-10:
   *  "confident voice feedbacks should always be at the top of the list").
   *  Absent → no CV rows, the panel renders exactly as before. */
  sessionIds?: string[];
  /** Final migration (founder 2026-08-10): the per-take review rows deep-link
   *  into the take's review from HERE — the one entry. A PROP, deliberately:
   *  the walker is the blind-labeling flow, and this panel must import
   *  nothing from that lane (N1); the Lounge — the one hub allowed to know
   *  both flows — wires the callback. Absent → the rows render without a
   *  tap. */
  onOpenTakeReview?: (sessionId: string) => void;
  onClose: () => void;
}) {
  // D-3 — back-gesture / Back dismisses this overlay instead of routing away.
  useBackDismiss(onClose);
  const [stars, setStars] = useState<ArcStar[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  // In-flight saves PER ROW — judging star B while A settles is fine, and
  // must actually be: a global lock with per-row disabling silently swallowed
  // taps on other rows while one PUT was in flight (review 2026-07-28). The
  // ref is the SYNCHRONOUS gate (state is too slow for a same-tick double
  // tap); the state mirror drives the spinners.
  const inFlightRef = useRef<Set<string>>(new Set());
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The wrong-kind picker open on at most one row (the gesture is per-row).
  const [pickerId, setPickerId] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  // The rewrite of what the star SAYS. Held as a draft and sent with the
  // verdict, exactly like the note: the BE's rule is that the edit→keep PAIR
  // is what trains the model, so the edit never travels on its own.
  const [editOpen, setEditOpen] = useState<Record<string, boolean>>({});
  const [whyDrafts, setWhyDrafts] = useState<Record<string, string>>({});
  const [replDrafts, setReplDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void fetchCoachArcStars(arcId).then((r) => {
      if (!active) return;
      setStars(r?.stars ?? null);
      setStatus(r ? "ready" : "error");
    });
    return () => {
      active = false;
    };
  }, [arcId]);

  // ── CONFIDENT-VOICE FEEDBACKS, FIRST (founder 2026-08-10). The blind
  // labeling rows for this arc's sessions, aggregated. The queue payload is
  // blind BY CONSTRUCTION (the BE serves words + audio and "NOTHING that
  // could hint at an answer"), so BLIND COACH holds per-row even though this
  // panel shows machine guesses further down: a CV row carries no guess to
  // see. Best-effort per session — a queue that fails to load just isn't
  // shown. ──
  const [cvRows, setCvRows] = useState<
    Array<QueuePiece & { sessionKey: string }>
  >([]);
  const [cvSaving, setCvSaving] = useState<string | null>(null);
  const [cvErrors, setCvErrors] = useState<Record<string, string>>({});
  const sessionsKey = (sessionIds ?? []).join(",");
  useEffect(() => {
    let active = true;
    const ids = sessionsKey ? sessionsKey.split(",") : [];
    if (ids.length === 0) {
      setCvRows([]);
      return;
    }
    void Promise.all(ids.map((sid) => fetchConfidenceQueue(sid))).then(
      (queues) => {
        if (!active) return;
        const out: Array<QueuePiece & { sessionKey: string }> = [];
        queues.forEach((q, i) => {
          for (const piece of q?.queue ?? []) {
            out.push({ ...piece, sessionKey: ids[i] });
          }
        });
        setCvRows(out);
      }
    );
    return () => {
      active = false;
    };
  }, [sessionsKey]);

  // TERNARY (founder 2026-08-10: same instrument as the coach snippet card
  // and the game — yes / no / Ambiguous + the unrateable abstention). Saves
  // through the same ternary write the snippet card uses.
  const labelVoice = (
    row: QueuePiece,
    value: TernaryValue | null,
    unrateable = false
  ) => {
    if (cvSaving !== null) return;
    const body = buildRatingBody(value, unrateable);
    if (!body) return;
    if (row.reReview) body.re_review = true;
    setCvSaving(row.snippetId);
    setCvErrors((e) => {
      const { [row.snippetId]: _gone, ...rest } = e;
      return rest;
    });
    void saveStateRating(row.snippetId, body).then((r) => {
      setCvSaving(null);
      if (!r.ok) {
        setCvErrors((e) => ({
          ...e,
          [row.snippetId]:
            r.error ?? "Couldn't save this label. Try again.",
        }));
        return;
      }
      setCvRows((rows) =>
        rows.map((x) =>
          x.snippetId === row.snippetId
            ? {
                ...x,
                label: {
                  value: unrateable ? null : value,
                  unrateable,
                  confident:
                    value === "yes" ? true : value === "no" ? false : null,
                  intensity: null,
                  note: null,
                },
              }
            : x
        )
      );
    });
  };

  // ── PUBLISH, FOLDED IN (founder 2026-08-10, "GO the publish fold-in").
  // The same arc-scoped action the review walker's wrap-up carries, with the
  // same server-mirrored gate (review-state's can_publish + blockers) and
  // the same shipped copy — so the coach finishes a review WHERE they
  // review, and the SESSIONS rows stop being a second way in. ──
  const [reviewState, setReviewState] = useState<CoachReviewState | null>(
    null
  );
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetchCoachReviewState(arcId).then((r) => {
      if (active) setReviewState(r);
    });
    return () => {
      active = false;
    };
  }, [arcId]);
  const handlePublish = () => {
    if (publishing || reviewState?.published) return;
    const publishPayloads = (reviewState?.takes ?? [])
      .map((take) => take.publishPayload)
      .filter((payload) => payload !== null);
    if (publishPayloads.length === 0) {
      setPublishError("Save at least one reviewed take before publishing.");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    void publishArc(arcId, publishPayloads).then((r) => {
      setPublishing(false);
      if (r.kind === "ok") {
        setReviewState((prev) =>
          prev ? { ...prev, published: true, canPublish: false } : prev
        );
        return;
      }
      setPublishError(r.message);
      void fetchCoachReviewState(arcId).then((rs) => setReviewState(rs));
    });
  };

  // Progress derives from the rows on screen, so it can never disagree with
  // them; the payload's summary block is deliberately not used (and its
  // confusions / false-negative bookkeeping is never rendered at all).
  const reviewed = stars?.filter((s) => s.verdict !== null).length ?? 0;

  /* ── AUTOSAVE (founder 2026-08-14) ────────────────────────────────────
   *  Typed drafts persist on their own: debounced while typing, flushed
   *  immediately on blur. The manual "Save note" / "Save wording" buttons
   *  stay — they are now a confirmation, not the only way the text survives.
   *
   *  The note rides the VERDICT body, so autosave can only fire once a
   *  verdict exists; until then the panel's "Saved with your verdict" line
   *  is the honest state. `save` already de-dupes concurrent writes per key
   *  via inFlightRef, so a blur landing on top of a pending debounce cannot
   *  double-post. */
  const autosaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );

  const flushDraft = useCallback(
    (star: ArcStar) => {
      const key = starRowKey(star);
      const t = autosaveTimers.current[key];
      if (t) {
        clearTimeout(t);
        delete autosaveTimers.current[key];
      }
      if (!star.verdict) return;
      const dirty =
        shouldAutosaveDraft(noteDrafts[key], star.note, true) ||
        shouldAutosaveDraft(whyDrafts[key], effectiveWhy(star), true) ||
        shouldAutosaveDraft(
          replDrafts[key],
          effectiveReplacement(star),
          true
        );
      if (!dirty) return;
      void save(star, star.verdict as StarVerdict,
                star.correctedDevice ?? undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [noteDrafts, whyDrafts, replDrafts]
  );

  /** Debounced sibling of flushDraft — called on every keystroke. */
  const queueAutosave = useCallback(
    (star: ArcStar) => {
      const key = starRowKey(star);
      const existing = autosaveTimers.current[key];
      if (existing) clearTimeout(existing);
      autosaveTimers.current[key] = setTimeout(() => {
        delete autosaveTimers.current[key];
        flushDraft(star);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [flushDraft]
  );

  // Nothing typed may be lost to an unmount mid-debounce.
  useEffect(() => {
    const timers = autosaveTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  async function save(
    star: ArcStar,
    verdict: StarVerdict,
    correctedDevice?: string
  ) {
    const key = starRowKey(star);
    if (inFlightRef.current.has(key)) return;
    const body = buildVerdictBody(star, verdict, {
      correctedDevice: correctedDevice ?? null,
      note: noteDrafts[key] ?? star.note ?? "",
      whyFinal: whyDrafts[key],
      replacementTextFinal: replDrafts[key],
    });
    // Unconstructable = wrong_kind without a pick; the picker is the only
    // path here with that verdict, so this is a guard, not a flow (N3).
    if (!body) return;
    inFlightRef.current.add(key);
    setSavingKeys((k) => ({ ...k, [key]: true }));
    setErrors((e) => {
      const { [key]: _dropped, ...rest } = e;
      return rest;
    });
    const res = await saveStarVerdict(star.snippetId, body);
    inFlightRef.current.delete(key);
    setSavingKeys((k) => {
      const { [key]: _done, ...rest } = k;
      return rest;
    });
    if (!res.ok) {
      // The BE's 400 reason is verbatim-safe; the migration-gate 500 names
      // the missing migration — show exactly what it said (degrade gracefully).
      setErrors((e) => ({
        ...e,
        [key]: res.error ?? "Couldn't save this verdict. Try again.",
      }));
      return;
    }
    setStars(
      (rows) =>
        rows?.map((r) =>
          starRowKey(r) === key
            ? {
                ...r,
                verdict,
                correctedDevice:
                  verdict === "wrong_kind" ? correctedDevice ?? null : null,
                note: body.note ?? null,
                // A rewrite that just landed makes this row edited, and the
                // row now says what the coach wrote — mirror both locally so
                // the chip and the text agree without a refetch.
                whyFinal: body.why_final ?? r.whyFinal,
                replacementTextFinal:
                  body.replacement_text_final ?? r.replacementTextFinal,
                edited:
                  r.edited ||
                  body.why_final !== undefined ||
                  body.replacement_text_final !== undefined,
              }
            : r
        ) ?? null
    );
    setPickerId((id) => (id === key ? null : id));
  }

  // SPEC §5 — the confident-voices strip: this arc's KEPT stars, i.e. the
  // moments the coach has verified, playable in place. Derived from the same
  // rows the body renders, so the strip and the review can never disagree.
  const verifiedVoices =
    stars?.filter(
      (s) => s.verdict === "keep" && s.audioRef && s.durationMs > 0
    ) ?? [];

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold text-foreground">
            Feedbacks review
          </span>
          {/* The established audience-lane label — this judgment trains the
              machine and is never shown to the student. */}
          <CoachEyebrow className="shrink-0">
            Coach only · training
          </CoachEyebrow>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {status === "ready" && stars && stars.length > 0 ? (
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {reviewed} of {stars.length} reviewed
            </span>
          ) : null}
          <OverlayCloseButton
            onClick={onClose}
            ariaLabel="Close feedbacks review"
          />
        </span>
      </div>

      {/* THE SCROLLER IS FULL WIDTH ON PURPOSE (founder 2026-08-14):
          "when I scroll outside the surface of the tables I want it to
          scroll too". The overflow used to live on the max-w-2xl column,
          so a wheel event in the margin either side of it landed on a
          fixed parent with nothing to scroll and did nothing. The scroll
          area now spans the viewport; the CONTENT stays centred and
          narrow inside it. */}
      <div className="scrollbar-none flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
        {cvRows.length > 0 ? (
          // CONFIDENT-VOICE FEEDBACKS — always at the top of the list
          // (founder 2026-08-10). Blind rows: play, read, answer. The copy
          // is the corpus view's shipped coach copy, verbatim.
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              Confident voices
            </span>
            {cvRows.map((row) => (
              <CoachCard key={row.snippetId}>
                {row.audioRef && row.durationMs > 0 ? (
                  <MediaPlayer
                    src={row.audioRef}
                    startOffsetMs={row.startOffsetMs}
                    durationMs={row.durationMs}
                  />
                ) : null}
                <div className="rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3">
                  <p className="text-[15px] leading-relaxed text-foreground">
                    {row.transcript}
                  </p>
                </div>
                {/* THE shared instrument (founder 2026-08-10): the same
                    component the snippet card and the game render — three
                    answers + the abstention, no per-surface drift. The
                    question keeps this row's shipped copy. */}
                <ConfidenceLabelChips
                  question="Was this voice confident?"
                  value={row.label?.value ?? null}
                  unrateable={row.label?.unrateable === true}
                  disabled={cvSaving === row.snippetId}
                  saving={cvSaving === row.snippetId}
                  error={cvErrors[row.snippetId] ?? null}
                  onPick={(v) => labelVoice(row, v)}
                  onToggleUnrateable={() =>
                    labelVoice(row, null, !(row.label?.unrateable === true))
                  }
                />
              </CoachCard>
            ))}
          </div>
        ) : null}
        {verifiedVoices.length > 0 ? (
          // The strip: confident voices at the TOP of the star review — the
          // founder's fold of what used to be a separate panel. Horizontal,
          // playback-only; judging still happens on the rows below.
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              Confident voices
            </span>
            <div className="scrollbar-none -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {verifiedVoices.map((s) => (
                <div
                  key={starRowKey(s)}
                  className="w-64 shrink-0 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-3"
                >
                  <MediaPlayer
                    src={s.audioRef!}
                    startOffsetMs={s.startOffsetMs}
                    durationMs={s.durationMs}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {status === "loading" ? (
          <div className="flex flex-1 items-center justify-center">
            <VoiceMark size={48} />
          </div>
        ) : status === "error" || stars === null ? (
          <p className="max-w-sm text-[15px] text-muted-foreground">
            Couldn&apos;t load the stars just now. Close and reopen this view
            to try again.
          </p>
        ) : stars.length === 0 ? (
          // Nothing to review is a valid state, not an error.
          <p className="text-[15px] text-muted-foreground">
            No stars fired on this arc.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {/* Founder 2026-08-10: confident-voice feedbacks first. Stable
                within each half, so the server's unjudged-first order still
                holds on both sides of the split.

                TWO TRIGGER STRINGS, ONE FAMILY. The 2026-08-13 re-point
                renamed the persisted trigger 'charisma' → 'confident' when
                the construct was retired; rows written before it keep the old
                word, because detector definitions are versioned rather than
                rewritten. Matching only the new one would have sorted every
                historical star to the bottom — silently, since a sort that
                loses a row still renders. Mirrors the backend's
                CONFIDENT_VOICE_TRIGGERS. */}
            {[...stars]
              .sort(
                (a, b) => Number(isConfidentVoice(b)) - Number(isConfidentVoice(a))
              )
              .map((s) => {
              const key = starRowKey(s);
              return (
              <CoachCard as="li" key={key}>
                <div className="flex items-center gap-2">
                  {/* Founder 2026-08-11: stars are eradicated platform-wide,
                      this coach tool included. A neutral approval mark — the
                      row is a machine suggestion awaiting the coach's
                      verdict, and the icon should say only that. */}
                  <BadgeCheck
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    fill="none"
                    aria-hidden
                  />
                  <CoachMetaPill>{starChipLabel(s)}</CoachMetaPill>
                  {s.takeIndex !== null ? (
                    <CoachMetaPill tone="outline">
                      Take {s.takeIndex}
                    </CoachMetaPill>
                  ) : null}
                  {/* The edit→keep pair only enters the corpus when the star
                      is KEPT (BE 2026-07-28) — so an edited star without a
                      verdict wears the amber nudge until it gets one. */}
                  {s.edited ? (
                    <CoachMetaPill tone={s.verdict === null ? "warn" : "muted"}>
                      {s.verdict === null ? "Edited — add a verdict" : "Edited"}
                    </CoachMetaPill>
                  ) : null}
                </div>

                {/* PLAYBACK FIRST (founder 2026-07-27) — a verdict on a star
                    is a verdict on a spoken moment, and the coach cannot make
                    it from the machine's why alone. The player clamps to
                    exactly the snippet's slice of the take's file (the same
                    parent+offset model the labeler uses). Rendered only when
                    the payload carries the audio — a text-only payload
                    degrades to a text-only row, never a broken player. */}
                {s.audioRef && s.durationMs > 0 ? (
                  <MediaPlayer
                    src={s.audioRef}
                    startOffsetMs={s.startOffsetMs}
                    durationMs={s.durationMs}
                  />
                ) : null}
                {s.transcript ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3">
                    <p className="text-[15px] leading-relaxed text-foreground">
                      {s.transcript}
                    </p>
                  </div>
                ) : null}

                {/* What the star SAYS — the coach's wording when they have
                    rewritten it, else the machine's (the "Edited" chip above
                    is what tells them which they are looking at). Both the
                    reason and the replacement may be present. */}
                {effectiveWhy(s) ? (
                  <p className="text-[14px] leading-relaxed text-foreground">
                    {effectiveWhy(s)}
                  </p>
                ) : null}
                {effectiveReplacement(s) ? (
                  <p className="rounded-xl bg-muted/40 px-3 py-2 text-[14px] leading-relaxed text-foreground">
                    <CoachEyebrow strong className="mr-2">
                      Suggested
                    </CoachEyebrow>
                    {effectiveReplacement(s)}
                  </p>
                ) : null}

                {/* The three-way control. Keep / Shouldn't fire save on tap;
                    Wrong kind only OPENS the picker — the pick saves (N3).
                    The saved verdict is the active pill, not a locked answer:
                    tapping another replaces it (N5). */}
                <div className="flex flex-wrap items-center gap-2">
                  <CoachChip
                    active={s.verdict === "keep"}
                    disabled={savingKeys[key] === true}
                    onClick={() => void save(s, "keep")}
                  >
                    Keep
                  </CoachChip>
                  <CoachChip
                    active={s.verdict === "wrong_kind"}
                    disabled={savingKeys[key] === true}
                    onClick={() =>
                      setPickerId((id) => (id === key ? null : key))
                    }
                  >
                    Wrong kind…
                  </CoachChip>
                  <CoachChip
                    active={s.verdict === "should_not_fire"}
                    disabled={savingKeys[key] === true}
                    onClick={() => void save(s, "should_not_fire")}
                  >
                    Shouldn&apos;t fire
                  </CoachChip>
                  {savingKeys[key] === true ? <VoiceMark size={20} /> : null}
                </div>

                {pickerId === key ? (
                  <div>
                    <p className="text-[12px] text-muted-foreground">
                      What should it have been?
                    </p>
                    {/* Options come from the row's device_options (N4) — or
                        the other star families when the kind has no devices.
                        Picking one IS the save; there is no second step. */}
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {correctionOptions(s).map((opt) => (
                        <CoachChip
                          key={opt}
                          size="sm"
                          active={
                            s.verdict === "wrong_kind" &&
                            s.correctedDevice === opt
                          }
                          disabled={savingKeys[key] === true}
                          onClick={() => void save(s, "wrong_kind", opt)}
                        >
                          {humanizeToken(opt)}
                        </CoachChip>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* THE EDITOR — the coach rewrites what the star says. Only
                    offered when there is something to rewrite. Like the note,
                    it rides the verdict: with no verdict yet it is held and
                    sent by the next Keep / Wrong-kind / Shouldn't-fire tap;
                    with one already saved, "Save wording" re-sends the SAME
                    verdict carrying the new text (the PUT is an upsert). */}
                {editOpen[key] ? (
                  <div className="flex flex-col gap-1.5 rounded-xl border border-border p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      What this star says
                    </p>
                    {s.why !== null || s.whyFinal !== null ? (
                      <textarea
                        aria-label="What this star says"
                        value={whyDrafts[key] ?? effectiveWhy(s) ?? ""}
                        onChange={(e) => {
                          setWhyDrafts((d) => ({ ...d, [key]: e.target.value }));
                          queueAutosave(s);
                        }}
                        onBlur={() => flushDraft(s)}
                        rows={2}
                        placeholder="The reason, in your words"
                        className="scrollbar-none w-full resize-none overflow-x-hidden rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
                      />
                    ) : null}
                    {s.replacementText !== null ||
                    s.replacementTextFinal !== null ? (
                      <textarea
                        aria-label="Suggested text"
                        value={
                          replDrafts[key] ?? effectiveReplacement(s) ?? ""
                        }
                        onChange={(e) => {
                          setReplDrafts((d) => ({ ...d, [key]: e.target.value }));
                          queueAutosave(s);
                        }}
                        onBlur={() => flushDraft(s)}
                        rows={2}
                        placeholder="The suggested wording"
                        className="scrollbar-none w-full resize-none overflow-x-hidden rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
                      />
                    ) : null}
                    {s.verdict ? (
                      <button
                        type="button"
                        disabled={savingKeys[key] === true}
                        onClick={() =>
                          void save(
                            s,
                            s.verdict as StarVerdict,
                            s.correctedDevice ?? undefined
                          )
                        }
                        className="self-start text-[12px] font-medium text-foreground underline disabled:opacity-50"
                      >
                        Save wording
                      </button>
                    ) : (
                      <p className="text-[12px] text-muted-foreground">
                        Saved with your verdict.
                      </p>
                    )}
                  </div>
                ) : effectiveWhy(s) !== null ||
                  effectiveReplacement(s) !== null ? (
                  <button
                    type="button"
                    onClick={() => setEditOpen((n) => ({ ...n, [key]: true }))}
                    className="self-start text-[12px] text-muted-foreground underline hover:text-foreground"
                  >
                    Edit what it says
                  </button>
                ) : null}

                {noteOpen[key] ? (
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      value={noteDrafts[key] ?? s.note ?? ""}
                      onChange={(e) => {
                        setNoteDrafts((d) => ({
                          ...d,
                          [key]: e.target.value,
                        }));
                        queueAutosave(s);
                      }}
                      onBlur={() => flushDraft(s)}
                      rows={2}
                      maxLength={NOTE_MAX_CHARS}
                      placeholder="Why — in your words"
                      className="scrollbar-none w-full resize-none overflow-x-hidden rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
                    />
                    {s.verdict ? (
                      <button
                        type="button"
                        disabled={savingKeys[key] === true}
                        onClick={() =>
                          void save(s, s.verdict as StarVerdict, s.correctedDevice ?? undefined)
                        }
                        className="self-start text-[12px] font-medium text-foreground underline disabled:opacity-50"
                      >
                        Save note
                      </button>
                    ) : (
                      <p className="text-[12px] text-muted-foreground">
                        Saved with your verdict.
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setNoteOpen((n) => ({ ...n, [key]: true }))
                    }
                    className="self-start text-[12px] text-muted-foreground underline hover:text-foreground"
                  >
                    {s.note ? "Edit note" : "Add note"}
                  </button>
                )}

                {errors[key] ? (
                  <CoachErrorLine>{errors[key]}</CoachErrorLine>
                ) : null}
              </CoachCard>
              );
            })}
          </ul>
        )}
        {reviewState && reviewState.takes.length > 0 ? (
          // The per-take review rows (final migration): each take's saved
          // state, tappable into its review while unsaved work remains. The
          // vocabulary is the wrap-up's shipped chip language.
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-foreground">
              Takes
            </span>
            {orderTakesForReview(reviewState.takes).map((t) => {
              const label =
                t.reviewState === "delivered"
                  ? "Delivered"
                  : t.reviewState === "reviewed"
                    ? "Reviewed"
                    : "To review";
              const tone =
                t.reviewState === "delivered"
                  ? "bg-success/10 text-success"
                  : t.reviewState === "reviewed"
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary/10 text-primary";
              const row = (
                <>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">
                    {t.takeIndex !== null ? `Take ${t.takeIndex}` : "Take"}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}
                  >
                    {label}
                  </span>
                </>
              );
              return onOpenTakeReview && t.reviewState !== "delivered" ? (
                <button
                  key={t.sessionId}
                  type="button"
                  onClick={() => onOpenTakeReview(t.sessionId)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50"
                >
                  {row}
                </button>
              ) : (
                <div
                  key={t.sessionId}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                >
                  {row}
                </div>
              );
            })}
          </div>
        ) : null}
        {reviewState ? (
          reviewState.published ? (
            <div className="flex items-center justify-center gap-1.5 rounded-full bg-success/10 py-2.5 text-[14px] font-medium text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Delivered
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={handlePublish}
                disabled={!reviewState.canPublish || publishing}
                className="h-11 w-full rounded-full bg-foreground text-[14px] font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                {publishing ? (
                  <Loader2
                    className="mr-1.5 h-4 w-4 animate-spin"
                    aria-hidden
                  />
                ) : null}
                Publish the full analysis
              </Button>
              {!reviewState.canPublish && reviewState.blockers.length > 0 ? (
                <p className="text-center text-[12px] text-muted-foreground">
                  {reviewState.blockers.map(blockerReason).join(" · ")}
                </p>
              ) : reviewState.advisories.length > 0 ? (
                /* Advisory, not a gate: says what a publish now would leave
                   out. The button above stays enabled. */
                <p className="text-center text-[12px] text-muted-foreground">
                  {reviewState.advisories.map(advisoryNote).join(" · ")}
                </p>
              ) : null}
              {publishError ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-center text-[13px] text-destructive">
                  {publishError}
                </p>
              ) : null}
            </div>
          )
        ) : null}
        </div>
      </div>
    </div>
  );
}
