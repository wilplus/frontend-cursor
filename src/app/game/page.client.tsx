"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import MediaPlayer from "@/components/results/MediaPlayer";
import { readExploreArc } from "@/lib/willab/exploreArc";
import {
  fetchArcBreakthroughs,
  type ArcBreakthrough,
} from "@/services/api/bestPresentation";
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
/*  /game — the confidence game (E5, founder 2026-07-28).                      */
/*                                                                            */
/*  ONE SCREEN, NO SCROLLING: each round fills the viewport — audio, the       */
/*  transcript, the two calls, and (after answering) the reveal BELOW, all     */
/*  within one screen. The next round REPLACES the screen; nothing stacks.     */
/*  Degenerately long content scrolls inside its own pane, never the page.     */
/*                                                                            */
/*  The header toggle (founder): default GAME — blind guessing, every answer   */
/*  a peer label; the other state MY BEST VOICE — playback of the coach-       */
/*  confirmed moments one by one with the explanation below. The game stays    */
/*  MOUNTED (hidden) while the toggle is away: unmounting would drop the       */
/*  verdicts and invite re-answers, which append junk labels (N3).             */
/*                                                                            */
/*  Truth is never in the rounds payload (N1) — key and decoy rounds render    */
/*  through identical markup; the reveal is the only teacher. No scores, no    */
/*  streaks, no tallies, ever (N2/AC-9). A decoy reveal reads neutral — the    */
/*  user's own words, never a failure (N5). All copy → founder sign-off.       */
/*                                                                            */
/*  Deferred by the founder's own staging: the end-of-arc always-play-or-skip  */
/*  offer comes "later, once the game is established".                         */
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
  const [tab, setTab] = useState<"game" | "voice">("game");
  const [status, setStatus] = useState<
    "loading" | "ready" | "no_arc" | "not_labeled" | "error"
  >("loading");
  const [session, setSession] = useState<GameSession | null>(null);

  useEffect(() => {
    if (!arcId) {
      setStatus("no_arc");
      return;
    }
    let active = true;
    void fetchArcGame(arcId, initialSnippetId).then((r) => {
      if (!active) return;
      setSession(r);
      // Zero rounds is a VALID state (the coach hasn't challenge-labeled any
      // moment on this arc yet), distinct from a failed load. 404 (not the
      // arc's owner) soft-fails to null → the plain error line; no coach
      // preview exists against these endpoints by design.
      setStatus(r ? (r.rounds.length === 0 ? "not_labeled" : "ready") : "error");
    });
    return () => {
      active = false;
    };
  }, [arcId, initialSnippetId]);

  return (
    <main className="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between px-5 pt-4">
        <h1 className="flex items-center gap-2 text-[17px] font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          Confidence game
        </h1>
        <OverlayCloseButton onClick={() => router.push("/chat")} />
      </div>

      {/* The mode toggle — Game is the default state by design. */}
      <div className="flex shrink-0 justify-center px-5 pt-3">
        <div className="flex rounded-full border border-border p-0.5">
          <TabPill active={tab === "game"} onClick={() => setTab("game")}>
            Game
          </TabPill>
          <TabPill active={tab === "voice"} onClick={() => setTab("voice")}>
            My best voice
          </TabPill>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 pb-4 pt-4">
        {/* The game keeps its state while hidden: an unmount would forget the
            answered rounds, and a re-answer is a duplicate peer label (N3). */}
        <div
          className={
            tab === "game" ? "flex min-h-0 flex-1 flex-col" : "hidden"
          }
        >
          {status === "loading" ? (
            <Centered>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </Centered>
          ) : status === "not_labeled" ? (
            <Centered>
              <p className="max-w-sm text-center text-[15px] text-muted-foreground">
                Your coach hasn&apos;t marked key moments here yet.
              </p>
            </Centered>
          ) : status === "no_arc" ? (
            <Centered>
              <p className="max-w-sm text-center text-[15px] text-muted-foreground">
                Record a presentation first, then come back to play your key
                moments.
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
        </div>

        {tab === "voice" ? <BestVoice arcId={arcId} /> : null}
      </div>
    </main>
  );
}

function TabPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center">{children}</div>
  );
}

/* ── the game: ONE round on screen; Next replaces it; ends on the library ── */

function GameRounds({
  arcId,
  session,
}: {
  arcId: string;
  session: GameSession;
}) {
  const [verdicts, setVerdicts] = useState<Record<string, GameVerdict>>({});
  const [current, setCurrent] = useState(0);
  const [finished, setFinished] = useState(false);

  if (finished) {
    return <EndScreen arcId={arcId} gameSessionId={session.gameSessionId} />;
  }

  const round = session.rounds[current];
  const verdict = verdicts[round.roundId] ?? null;
  const isLast = current === session.rounds.length - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="shrink-0 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        Round {current + 1} of {session.rounds.length}
      </p>
      {current === 0 && !verdict ? (
        <p className="shrink-0 text-[13px] leading-snug text-muted-foreground">
          Some of these were your key moments; some were just moments. Listen,
          read, and call each one.
        </p>
      ) : null}

      <RoundCard
        key={round.roundId}
        arcId={arcId}
        round={round}
        verdict={verdict}
        onVerdict={(v) =>
          setVerdicts((prev) => ({ ...prev, [round.roundId]: v }))
        }
      />

      {verdict ? (
        <button
          type="button"
          onClick={() => (isLast ? setFinished(true) : setCurrent((c) => c + 1))}
          className="shrink-0 self-center rounded-full bg-foreground px-8 py-2.5 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90"
        >
          {isLast ? "Finish" : "Next"}
        </button>
      ) : null}
    </div>
  );
}

/* ── one round, one screen: play + read → call it → reveal below ── */

function RoundCard({
  arcId,
  round,
  verdict,
  onVerdict,
}: {
  arcId: string;
  round: GameRound;
  verdict: GameVerdict | null;
  onVerdict: (v: GameVerdict) => void;
}) {
  const [submitting, setSubmitting] = useState<boolean | null>(null); // the answer in flight
  // N3 — one POST per decision, enforced SYNCHRONOUSLY. The `submitting`
  // state alone is not a guard: two clicks in the same tick both read it as
  // null before React commits, and each answer persists as a peer label
  // server-side — a double-click would append a duplicate into the corpus.
  const inFlightRef = useRef(false);
  const [failed, setFailed] = useState(false);

  async function answer(isKeyMoment: boolean) {
    if (inFlightRef.current || verdict) return;
    inFlightRef.current = true;
    setFailed(false);
    setSubmitting(isKeyMoment);
    const v = await submitGameAnswer(arcId, round.roundId, isKeyMoment);
    setSubmitting(null);
    if (v) onVerdict(v);
    else {
      // Only a FAILED post re-arms the buttons — a success keeps the round
      // answered forever (the label is already in the corpus).
      inFlightRef.current = false;
      setFailed(true);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {round.audioRef ? (
        <div className="shrink-0">
          <MediaPlayer
            src={round.audioRef}
            startOffsetMs={round.startOffsetMs}
            durationMs={round.durationMs}
          />
        </div>
      ) : null}

      {/* N1 — this container is IDENTICAL for key and decoy rounds; the only
          teacher is the reveal. Long transcripts scroll inside this pane so
          the screen itself never does. */}
      <div className="max-h-[30vh] shrink-0 overflow-y-auto rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3 scrollbar-none">
        <p className="text-[15px] leading-relaxed text-foreground">
          {round.transcript}
        </p>
      </div>

      {!verdict ? (
        <div className="flex shrink-0 gap-2">
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
            {submitting === false ? "Checking..." : "Solid, not key"}
          </button>
        </div>
      ) : (
        <VerdictReveal verdict={verdict} />
      )}
      {failed ? (
        <p className="shrink-0 text-[13px] text-muted-foreground">
          Couldn&apos;t check that one. Tap your answer again.
        </p>
      ) : null}
    </div>
  );
}

/* ── the reveal, BELOW the moment, inside the same screen ── */

function VerdictReveal({ verdict }: { verdict: GameVerdict }) {
  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none">
      {/* The guess verdict — qualitative, and NEVER red: an incorrect guess
          in this game usually means the user called their own solid moment a
          key one, which is not a failure state (N5). Amber = informational. */}
      <span
        className={`shrink-0 self-start rounded-full px-3 py-1 text-[13px] font-semibold ${
          verdict.correct
            ? "bg-green-600/15 text-green-700 dark:text-green-400"
            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        }`}
      >
        {verdict.correct ? "Correct" : "Not quite"}
      </span>

      {/* What the moment actually WAS. A decoy reads as neutral fact about
          the user's own words — "solid" — never as criticism (N5); threat-
          labeled decoys are indistinguishable from unmarked ones here. */}
      {verdict.truthIsKey !== null ? (
        <p className="shrink-0 text-[14px] text-muted-foreground">
          {verdict.truthIsKey
            ? "This was one of your key moments."
            : "This one was solid — not a key moment."}
        </p>
      ) : null}

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
        <div className="max-h-[26vh] w-[60%] max-w-[320px] shrink-0 overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={verdict.videoRef}
            controls
            playsInline
            className="max-h-[26vh] w-full bg-black"
          />
        </div>
      ) : null}
    </div>
  );
}

/* ── after the last round: no score screen (N2) — the library framing ── */

function EndScreen({
  arcId,
  gameSessionId,
}: {
  arcId: string;
  gameSessionId: string | null;
}) {
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");
  const [saved, setSaved] = useState<SavedGameSession[]>([]);

  useEffect(() => {
    void fetchSavedGameSessions().then(setSaved);
  }, [saveState]);

  async function handleSave() {
    if (saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");
    const ok = await saveGameSession(arcId, gameSessionId);
    setSaveState(ok ? "saved" : "failed");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 pt-6">
      <Sparkles className="h-6 w-6 shrink-0 text-primary" aria-hidden />
      {/* The library framing, not a summary score (N2). A saved game is a
          bookmark, not a freeze — reopening re-derives the rounds from the
          coach's current truth, so this is "practice this talk again",
          never "resume where you left off". */}
      <p className="max-w-sm shrink-0 text-center text-[15px] leading-relaxed text-foreground">
        These moments are yours to come back to.
      </p>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saveState === "saving" || saveState === "saved"}
        className="flex shrink-0 items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
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
        <p className="shrink-0 text-[13px] text-muted-foreground">
          Couldn&apos;t save right now. Try again in a moment.
        </p>
      ) : null}

      {saved.length > 0 ? (
        <div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-y-auto border-t border-border pt-4 scrollbar-none">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Daily practice
          </p>
          {saved.map((s) => {
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
                className="flex shrink-0 items-center justify-between rounded-xl border border-border px-4 py-3"
              >
                <p className="text-[14px] text-foreground">
                  {s.topic ?? "Practice session"}
                </p>
                <p className="text-[12px] text-muted-foreground">{label}</p>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* ── MY BEST VOICE — the coach-confirmed moments, one by one, explained ── */

function BestVoice({ arcId }: { arcId: string | null }) {
  const [items, setItems] = useState<ArcBreakthrough[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">(
    "loading"
  );
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!arcId) {
      setStatus("empty");
      return;
    }
    let active = true;
    void fetchArcBreakthroughs(arcId).then((r) => {
      if (!active) return;
      const list = r?.breakthroughs ?? null;
      setItems(list);
      setStatus(list === null ? "error" : list.length === 0 ? "empty" : "ready");
    });
    return () => {
      active = false;
    };
  }, [arcId]);

  if (status === "loading") {
    return (
      <Centered>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Centered>
    );
  }
  if (status === "empty" || !items || items.length === 0) {
    return (
      <Centered>
        <p className="max-w-sm text-center text-[15px] text-muted-foreground">
          Your coach hasn&apos;t marked key moments here yet.
        </p>
      </Centered>
    );
  }
  if (status === "error") {
    return (
      <Centered>
        <p className="max-w-sm text-center text-[15px] text-muted-foreground">
          Couldn&apos;t load your moments. Try again in a moment.
        </p>
      </Centered>
    );
  }

  const item = items[Math.min(i, items.length - 1)];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="shrink-0 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        Moment {Math.min(i, items.length - 1) + 1} of {items.length}
      </p>

      {item.audioRef ? (
        <div className="shrink-0">
          <MediaPlayer
            src={item.audioRef}
            startOffsetMs={item.startOffsetMs}
            durationMs={item.durationMs}
          />
        </div>
      ) : null}

      {item.text ? (
        <div className="max-h-[32vh] shrink-0 overflow-y-auto rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3 scrollbar-none">
          <p className="text-[15px] leading-relaxed text-foreground">
            {item.text}
          </p>
        </div>
      ) : null}

      {/* The explanation below — the coach's note on why this moment. */}
      {item.note ? (
        <div className="min-h-0 overflow-y-auto rounded-xl bg-muted px-4 py-3 scrollbar-none">
          <p className="text-[14px] leading-relaxed text-foreground">
            {item.note}
          </p>
        </div>
      ) : null}

      <div className="mt-auto flex shrink-0 justify-between pt-2">
        <button
          type="button"
          onClick={() => setI((n) => Math.max(0, n - 1))}
          disabled={i === 0}
          className="flex items-center gap-1 rounded-full border border-border px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Previous
        </button>
        <button
          type="button"
          onClick={() => setI((n) => Math.min(items.length - 1, n + 1))}
          disabled={i >= items.length - 1}
          className="flex items-center gap-1 rounded-full border border-border px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
