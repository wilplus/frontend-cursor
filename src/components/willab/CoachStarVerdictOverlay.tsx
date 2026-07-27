"use client";

import { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import {
  buildVerdictBody,
  correctionOptions,
  fetchCoachArcStars,
  humanizeToken,
  NOTE_MAX_CHARS,
  saveStarVerdict,
  starChipLabel,
  starRowKey,
  type ArcStar,
  type StarVerdict,
} from "@/services/api/starVerdicts";

/* -------------------------------------------------------------------------- */
/*  CoachStarVerdictOverlay — the coach judges the machine's stars (2026-07-27) */
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

export default function CoachStarVerdictOverlay({
  arcId,
  onClose,
}: {
  arcId: string;
  onClose: () => void;
}) {
  // D-3 — back-gesture / Back dismisses this overlay instead of routing away.
  useBackDismiss(onClose);
  const [stars, setStars] = useState<ArcStar[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  // One in-flight save at a time (the id of the row being saved). Pills
  // disable on the busy row only — judging star B while A settles is fine.
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The wrong-kind picker open on at most one row (the gesture is per-row).
  const [pickerId, setPickerId] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

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

  // Progress derives from the rows on screen, so it can never disagree with
  // them; the payload's summary block is deliberately not used (and its
  // confusions / false-negative bookkeeping is never rendered at all).
  const reviewed = stars?.filter((s) => s.verdict !== null).length ?? 0;

  async function save(
    star: ArcStar,
    verdict: StarVerdict,
    correctedDevice?: string
  ) {
    if (savingId) return;
    const body = buildVerdictBody(star, verdict, {
      correctedDevice: correctedDevice ?? null,
      note: noteDrafts[starRowKey(star)] ?? star.note ?? "",
    });
    // Unconstructable = wrong_kind without a pick; the picker is the only
    // path here with that verdict, so this is a guard, not a flow (N3).
    if (!body) return;
    const key = starRowKey(star);
    setSavingId(key);
    setErrors((e) => {
      const { [key]: _dropped, ...rest } = e;
      return rest;
    });
    const res = await saveStarVerdict(star.snippetId, body);
    setSavingId(null);
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
              }
            : r
        ) ?? null
    );
    setPickerId((id) => (id === key ? null : id));
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold text-foreground">
            Star review
          </span>
          {/* The established audience-lane label — this judgment trains the
              machine and is never shown to the student. */}
          <span className="shrink-0 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
            Coach only · training
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {status === "ready" && stars && stars.length > 0 ? (
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {reviewed} of {stars.length} reviewed
            </span>
          ) : null}
          <OverlayCloseButton onClick={onClose} ariaLabel="Close star review" />
        </span>
      </div>

      <div className="scrollbar-none mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
        {status === "loading" ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            {stars.map((s) => {
              const key = starRowKey(s);
              return (
              <li
                key={key}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-2">
                  {/* Outline star = unverified machine suggestion, the same
                      icon language the student text uses. */}
                  <Star
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    fill="none"
                    aria-hidden
                  />
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {starChipLabel(s)}
                  </span>
                </div>

                {/* The machine's stated reason and/or its replacement text —
                    whichever is present; both may be. */}
                {s.why ? (
                  <p className="text-[14px] leading-relaxed text-foreground">
                    {s.why}
                  </p>
                ) : null}
                {s.replacementText ? (
                  <p className="rounded-xl bg-muted/40 px-3 py-2 text-[14px] leading-relaxed text-foreground">
                    <span className="mr-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Suggested
                    </span>
                    {s.replacementText}
                  </p>
                ) : null}

                {/* The three-way control. Keep / Shouldn't fire save on tap;
                    Wrong kind only OPENS the picker — the pick saves (N3).
                    The saved verdict is the active pill, not a locked answer:
                    tapping another replaces it (N5). */}
                <div className="flex flex-wrap items-center gap-2">
                  <VerdictPill
                    active={s.verdict === "keep"}
                    disabled={savingId === key}
                    onClick={() => void save(s, "keep")}
                  >
                    Keep
                  </VerdictPill>
                  <VerdictPill
                    active={s.verdict === "wrong_kind"}
                    disabled={savingId === key}
                    onClick={() =>
                      setPickerId((id) => (id === key ? null : key))
                    }
                  >
                    Wrong kind…
                  </VerdictPill>
                  <VerdictPill
                    active={s.verdict === "should_not_fire"}
                    disabled={savingId === key}
                    onClick={() => void save(s, "should_not_fire")}
                  >
                    Shouldn&apos;t fire
                  </VerdictPill>
                  {savingId === key ? (
                    <Loader2
                      className="h-4 w-4 animate-spin text-muted-foreground"
                      aria-hidden
                    />
                  ) : null}
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
                        <button
                          key={opt}
                          type="button"
                          aria-pressed={
                            s.verdict === "wrong_kind" &&
                            s.correctedDevice === opt
                          }
                          disabled={savingId === key}
                          onClick={() => void save(s, "wrong_kind", opt)}
                          className={`rounded-full border px-3 py-1 text-[12px] transition-colors disabled:opacity-50 ${
                            s.verdict === "wrong_kind" &&
                            s.correctedDevice === opt
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground hover:border-primary/50"
                          }`}
                        >
                          {humanizeToken(opt)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {noteOpen[key] ? (
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      value={noteDrafts[key] ?? s.note ?? ""}
                      onChange={(e) =>
                        setNoteDrafts((d) => ({
                          ...d,
                          [key]: e.target.value,
                        }))
                      }
                      rows={2}
                      maxLength={NOTE_MAX_CHARS}
                      placeholder="Why — in your words"
                      className="scrollbar-none w-full resize-none overflow-x-hidden rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
                    />
                    {s.verdict ? (
                      <button
                        type="button"
                        disabled={savingId === key}
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
                  <p className="text-[12px] text-destructive">
                    {errors[key]}
                  </p>
                ) : null}
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** One pill of the three-way control — the coach-surface selectable pill
 *  (CoachSnippetReviewCard's DIRECTIONS idiom, plus aria-pressed). */
function VerdictPill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-50 ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}
