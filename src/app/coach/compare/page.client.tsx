"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useUserProfile } from "@/components/willab/useUserProfile";
import {
  fetchAbPairs,
  saveAbVerdict,
  type AbPair,
  type AbSide,
  type AbVerdict,
} from "@/services/api/abPairs";

/* -------------------------------------------------------------------------- */
/*  /coach/compare — the blinded A/B slide comparison (founder 2026-08-11)     */
/*                                                                            */
/*  Two deliveries of the SAME slide, from two takes of the same talk by the   */
/*  same speaker. The coach says which landed better. That single act is what  */
/*  unblocks piece (b) twice over: it anchors power_score's delivery term      */
/*  against human ratings, and each judged pair is a matched cross-take pair   */
/*  for the alignment spike that has no real multi-take arcs to run on.        */
/*                                                                            */
/*  THE SCREEN'S ONE JOB IS TO GIVE AWAY NOTHING. The payload carries no       */
/*  take identity, so this component cannot leak one even by accident — but    */
/*  the design has to hold up its end too:                                     */
/*                                                                            */
/*    · the sides are "A" and "B", never "take 1" and "take 2", and never in   */
/*      an order the coach could learn to read;                               */
/*    · no counters that imply progress through a chronology;                  */
/*    · TOO CLOSE TO CALL is a first-class answer, not a skip. A rater with    */
/*      no way to say "these are the same" invents a preference, and an        */
/*      invented preference is indistinguishable from a real one in the data.  */
/*                                                                            */
/*  AC-9 is not strained here — nothing on this screen reaches a user — but    */
/*  the same discipline applies: no score is shown to the coach either. They   */
/*  are the instrument; showing them a machine reading would contaminate it.   */
/* -------------------------------------------------------------------------- */

export default function ComparePageClient() {
  const { isCoach, loading } = useUserProfile();
  const [arcId, setArcId] = useState("");
  const [pairs, setPairs] = useState<AbPair[] | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [ratedCount, setRatedCount] = useState(0);
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState<AbVerdict | null>(null);
  const [failed, setFailed] = useState(false);
  const [judged, setJudged] = useState(0);

  // The arc rides in the query string so a coach can be handed a link to a
  // specific talk. Read after mount — the server has no query string, and
  // reading one during render is how a page disagrees with its own first
  // paint.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("arc") ?? "";
    setArcId(q);
  }, []);

  const load = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setPairs(null);
    setFailed(false);
    const r = await fetchAbPairs(id.trim());
    if (!r) {
      setFailed(true);
      return;
    }
    setPairs(r.pairs);
    setReason(r.reason);
    setRatedCount(r.ratedCount);
    setAt(0);
  }, []);

  useEffect(() => {
    if (isCoach && arcId) void load(arcId);
  }, [isCoach, arcId, load]);

  async function judge(verdict: AbVerdict) {
    const pair = pairs?.[at];
    if (!pair || busy) return;
    setBusy(verdict);
    const ok = await saveAbVerdict(arcId, pair.pairId, verdict);
    setBusy(null);
    if (!ok) {
      setFailed(true);
      return;
    }
    setJudged((n) => n + 1);
    setAt((i) => i + 1);
  }

  if (loading) {
    return (
      <main className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }
  // Nothing for a non-coach, even by direct URL — the same rule the corpus
  // workbench follows. The BE would refuse them anyway.
  if (!isCoach) {
    return (
      <main className="flex h-full items-center justify-center bg-background px-6">
        <p className="text-center text-[15px] text-muted-foreground">
          Nothing here.
        </p>
      </main>
    );
  }

  const pair = pairs?.[at] ?? null;
  const done = pairs !== null && at >= pairs.length;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 bg-background px-5 py-8">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Coach only · training
        </p>
        <h1 className="text-[22px] font-semibold text-foreground">
          Which delivery landed better?
        </h1>
        <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">
          Two takes of the same slide, by the same speaker. You are not told
          which take is which, and the order is shuffled — that is deliberate,
          and it is what makes these judgments usable as training data.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[12px] text-muted-foreground">Arc id</span>
          <input
            value={arcId}
            onChange={(e) => setArcId(e.target.value)}
            placeholder="paste an arc id"
            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-[14px] text-foreground outline-none focus:border-foreground"
          />
        </label>
        <button
          type="button"
          onClick={() => void load(arcId)}
          className="h-10 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          Load
        </button>
      </div>

      {failed ? (
        <p className="text-[13px] text-destructive">
          Couldn&apos;t reach the comparison queue. Try again.
        </p>
      ) : null}

      {arcId && pairs === null && !failed ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {pairs !== null && pairs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-[14px] text-foreground">
            {reason === "needs at least two spoken takes"
              ? "This arc has only one spoken take — there is nothing to compare yet."
              : reason === "no deck on this arc"
                ? "This arc has no deck, so there are no slides to line up."
                : "Every pair on this arc has been judged."}
          </p>
          {ratedCount > 0 ? (
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {ratedCount} judgment{ratedCount === 1 ? "" : "s"} recorded on
              this arc.
            </p>
          ) : null}
        </div>
      ) : null}

      {pair ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-medium text-foreground">
              Slide {pair.slideIndex + 1}
              {pair.slideTitle ? (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  — {pair.slideTitle}
                </span>
              ) : null}
            </p>
            {/* How many are LEFT, never "3 of 30" — a position in a list is a
                cue about where in the arc you are, and this queue is
                deliberately not chronological. */}
            <p className="text-[12px] tabular-nums text-muted-foreground">
              {(pairs?.length ?? 0) - at} left to judge
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Side label="A" side={pair.left} />
            <Side label="B" side={pair.right} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Choice
              onClick={() => void judge("left")}
              busy={busy === "left"}
              disabled={busy !== null}
            >
              A landed better
            </Choice>
            <Choice
              onClick={() => void judge("right")}
              busy={busy === "right"}
              disabled={busy !== null}
            >
              B landed better
            </Choice>
            <Choice
              onClick={() => void judge("tie")}
              busy={busy === "tie"}
              disabled={busy !== null}
              quiet
            >
              Too close to call
            </Choice>
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Judge the delivery you can hear and read — not which words you
            would have written. &ldquo;Too close to call&rdquo; is a real
            answer: it tells us where the machine must not claim a difference.
          </p>
        </>
      ) : null}

      {done && pairs.length > 0 ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6">
          <Check className="h-5 w-5 text-success" aria-hidden />
          <p className="text-[14px] text-foreground">
            Queue finished — {judged} judgment{judged === 1 ? "" : "s"} this
            session.
          </p>
        </div>
      ) : null}
    </main>
  );
}

function Side({ label, side }: { label: string; side: AbSide }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-background">
        {label}
      </span>
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
        {side.transcript || (
          <span className="text-muted-foreground">(nothing transcribed)</span>
        )}
      </p>
      {side.audioRef ? (
        // The whole take's audio, seeked to this slide. The words alone are
        // half the judgment — delivery is the half we are trying to measure.
        <audio
          controls
          preload="none"
          src={`${side.audioRef}#t=${Math.max(
            0,
            Math.floor((side.startOffsetMs ?? 0) / 1000)
          )}`}
          className="w-full"
        />
      ) : null}
    </div>
  );
}

function Choice({
  children,
  onClick,
  busy,
  disabled,
  quiet = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  quiet?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition-colors disabled:opacity-50 ${
        quiet
          ? "border border-border text-foreground hover:bg-muted"
          : "bg-foreground text-background hover:bg-foreground/90"
      }`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
