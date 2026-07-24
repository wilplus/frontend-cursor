"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import MediaPlayer from "@/components/results/MediaPlayer";
import { readExploreArc } from "@/lib/willab/exploreArc";
import {
  fetchArcGame,
  submitGameAnswer,
  saveGameSession,
  fetchSavedGameSessions,
  splitTintedSegments,
  type GameRound,
  type GameSession,
  type GameVerdict,
  type SavedGameSession,
} from "@/services/api/arcGame";

/* -------------------------------------------------------------------------- */
/*  /game — the key-moment game (E5).                                          */
/*                                                                            */
/*  Rounds mix the user's coach-confirmed key moments with their own unmarked   */
/*  moments; they guess which is which, then the "Here is why" reveal teaches   */
/*  through their own patterns. Rounds appear one at a time (the next reveals   */
/*  after answering); the scroll ends in "Save to daily practice". Behind the    */
/*  404/501 renders a calm coming-soon (the engine ships BE-side); free.       */
/* -------------------------------------------------------------------------- */

export default function GamePageClient({
  initialArcId,
  initialSnippetId,
}: {
  initialArcId: string | null;
  initialSnippetId: string | null;
}) {
  const router = useRouter();
  // The training to play: the deep-linked arc, else the active explore arc.
  const [arcId] = useState<string | null>(
    () => initialArcId ?? readExploreArc()?.arcId ?? null
  );
  const [status, setStatus] = useState<
    "loading" | "ready" | "coming_soon" | "empty" | "error"
  >("loading");
  const [session, setSession] = useState<GameSession | null>(null);
  // Archive (saved daily-practice sessions) — hidden when empty.
  const [saved, setSaved] = useState<SavedGameSession[]>([]);

  useEffect(() => {
    void fetchSavedGameSessions().then(setSaved);
  }, []);

  useEffect(() => {
    if (!arcId) {
      setStatus("empty");
      return;
    }
    let active = true;
    void fetchArcGame(arcId, initialSnippetId).then((r) => {
      if (!active) return;
      if (r && "notAvailable" in r) {
        setStatus("coming_soon");
        return;
      }
      setSession(r);
      setStatus(r ? "ready" : "error");
    });
    return () => {
      active = false;
    };
  }, [arcId, initialSnippetId]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col bg-background">
      <div className="flex items-center justify-between px-5 pt-4">
        <h1 className="flex items-center gap-2 text-[17px] font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          Key moments
        </h1>
        <OverlayCloseButton onClick={() => router.push("/chat")} />
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        {status === "loading" ? (
          <Centered>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </Centered>
        ) : status === "coming_soon" ? (
          <Centered>
            <div className="flex max-w-sm flex-col items-center gap-2 text-center">
              <Sparkles className="h-6 w-6 text-primary" aria-hidden />
              <p className="text-[15px] font-semibold text-foreground">
                The game is almost ready
              </p>
              <p className="text-[14px] leading-relaxed text-muted-foreground">
                Your key-moment game is being prepared. Check back soon.
              </p>
            </div>
          </Centered>
        ) : status === "empty" ? (
          <Centered>
            <p className="max-w-sm text-center text-[15px] text-muted-foreground">
              Record a presentation first, then come back to play your key moments.
            </p>
          </Centered>
        ) : status === "error" || !session ? (
          <Centered>
            <p className="max-w-sm text-center text-[15px] text-muted-foreground">
              Couldn&apos;t load the game. Try again in a moment.
            </p>
          </Centered>
        ) : (
          <GameRounds arcId={arcId!} session={session} />
        )}

        {saved.length > 0 ? <SavedSessions sessions={saved} /> : null}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center py-16">{children}</div>
  );
}

/* ── the round stack: next round reveals after the current is answered ── */

function GameRounds({
  arcId,
  session,
}: {
  arcId: string;
  session: GameSession;
}) {
  const [verdicts, setVerdicts] = useState<Record<string, GameVerdict>>({});
  const answeredCount = session.rounds.filter((r) => verdicts[r.roundId]).length;
  // Reveal rounds up to the first unanswered one.
  const visible = session.rounds.slice(
    0,
    Math.min(answeredCount + 1, session.rounds.length)
  );
  const allAnswered = answeredCount === session.rounds.length;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle"
  );

  async function handleSave() {
    if (saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");
    const ok = await saveGameSession(arcId, session.gameSessionId);
    setSaveState(ok ? "saved" : "failed");
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        Some of these were your key moments; some were just moments. Listen,
        read, and call each one.
      </p>

      {visible.map((round, i) => (
        <RoundCard
          key={round.roundId}
          arcId={arcId}
          round={round}
          index={i}
          verdict={verdicts[round.roundId] ?? null}
          onVerdict={(v) =>
            setVerdicts((prev) => ({ ...prev, [round.roundId]: v }))
          }
        />
      ))}

      {allAnswered ? (
        <div className="flex flex-col items-center gap-2 pb-8 pt-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveState === "saving" || saveState === "saved"}
            className="flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
          >
            {saveState === "saved" ? (
              <>
                <Check className="h-4 w-4" aria-hidden />
                Saved to daily practice
              </>
            ) : saveState === "saving" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving...
              </>
            ) : (
              "Save to daily practice"
            )}
          </button>
          {saveState === "failed" ? (
            <p className="text-[13px] text-muted-foreground">
              Couldn&apos;t save right now. Try again in a moment.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ── one round: play + read → call it → verdict + "Here is why" ── */

function RoundCard({
  arcId,
  round,
  index,
  verdict,
  onVerdict,
}: {
  arcId: string;
  round: GameRound;
  index: number;
  verdict: GameVerdict | null;
  onVerdict: (v: GameVerdict) => void;
}) {
  const [submitting, setSubmitting] = useState<boolean | null>(null); // the answer in flight
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  // Fresh rounds scroll into view as they reveal (round 1 stays put).
  useEffect(() => {
    if (index > 0 && !verdict) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function answer(isKeyMoment: boolean) {
    if (submitting !== null || verdict) return;
    setFailed(false);
    setSubmitting(isKeyMoment);
    const v = await submitGameAnswer(arcId, round.roundId, isKeyMoment);
    setSubmitting(null);
    if (v) onVerdict(v);
    else setFailed(true);
  }

  return (
    <div ref={ref} className="flex scroll-mt-4 flex-col gap-3">
      <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        Round {index + 1}
      </p>

      {round.audioRef ? (
        <MediaPlayer
          src={round.audioRef}
          startOffsetMs={round.startOffsetMs}
          durationMs={round.durationMs}
        />
      ) : null}

      <div className="rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3">
        <p className="text-[15px] leading-relaxed text-foreground">
          {round.transcript}
        </p>
      </div>

      {!verdict ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void answer(true)}
            disabled={submitting !== null}
            className="flex-1 rounded-full bg-primary py-2.5 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting === true ? "Checking..." : "Key moment"}
          </button>
          <button
            type="button"
            onClick={() => void answer(false)}
            disabled={submitting !== null}
            className="flex-1 rounded-full bg-muted py-2.5 text-[14px] font-medium text-foreground transition-colors hover:bg-muted/80 disabled:opacity-60"
          >
            {submitting === false ? "Checking..." : "Neutral"}
          </button>
        </div>
      ) : (
        <VerdictReveal verdict={verdict} />
      )}
      {failed ? (
        <p className="text-[13px] text-muted-foreground">
          Couldn&apos;t check that one. Tap your answer again.
        </p>
      ) : null}
    </div>
  );
}

/* ── verdict badge + the "Here is why" reveal ── */

function VerdictReveal({ verdict }: { verdict: GameVerdict }) {
  return (
    <div className="flex flex-col gap-3">
      <span
        className={`self-start rounded-full px-3 py-1 text-[13px] font-semibold ${
          verdict.correct
            ? "bg-green-600/15 text-green-700 dark:text-green-400"
            : "bg-red-500/15 text-red-600 dark:text-red-400"
        }`}
      >
        {verdict.correct ? "Correct" : "Not quite"}
      </span>

      {verdict.why.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl bg-muted px-4 py-3">
          {verdict.why.slice(0, 3).map((p, i) => (
            <p key={i} className="text-[14px] leading-relaxed text-foreground">
              {splitTintedSegments(p).map((seg, j) =>
                seg.tinted ? (
                  <span key={j} className="font-medium text-primary">
                    {seg.text}
                  </span>
                ) : (
                  <span key={j}>{seg.text}</span>
                )
              )}
            </p>
          ))}
        </div>
      ) : null}

      {verdict.videoRef ? (
        <div className="w-[60%] max-w-[320px] overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={verdict.videoRef}
            controls
            playsInline
            className="w-full bg-black"
          />
        </div>
      ) : null}
    </div>
  );
}

/* ── the daily-practice archive ── */

function SavedSessions({ sessions }: { sessions: SavedGameSession[] }) {
  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
      <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        Daily practice
      </p>
      {sessions.map((s) => {
        const d = new Date(s.savedAt);
        const label = Number.isNaN(d.getTime())
          ? s.savedAt
          : d.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
        return (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
          >
            <p className="text-[14px] text-foreground">
              {s.topic ?? "Practice session"}
            </p>
            <p className="text-[12px] text-muted-foreground">{label}</p>
          </div>
        );
      })}
    </div>
  );
}
