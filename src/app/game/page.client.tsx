"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import ModeToggle from "@/components/willab/ModeToggle";
import { VoiceMark } from "@/components/willab/LoadingState";
import ConfidenceLabelChips from "@/components/willab/ConfidenceLabelChips";
import { type TernaryValue } from "@/services/api/stateRatings";
import { readExploreArc } from "@/lib/willab/exploreArc";
import { SCREEN_BOTTOM_GAP } from "@/lib/screenChrome";
import {
  fetchVoiceAlbum,
  type VoiceAlbumEntry,
} from "@/services/api/bestPresentation";
import {
  fetchArcGame,
  submitGameAnswer,
  saveGameSession,
  fetchSavedGameSessions,
  splitTintedSegments,
  type GameSession,
  type GameVerdict,
  type SavedGameSession,
} from "@/services/api/arcGame";

/* -------------------------------------------------------------------------- */
/*  /game — Voice-game (E5, founder design pass 2026-07-28).                   */
/*                                                                            */
/*  IMMERSIVE AND CENTRAL: every round is one binary dilemma — a big playback  */
/*  hero in the middle (tapped every round, so it is large and comfortable),   */
/*  the neutral grey call on the LEFT, the green Confident call on the RIGHT   */
/*  (the swipe-left / swipe-right feel, as buttons), and once answered the     */
/*  short explanation BELOW. One screen, no page scroll; Next replaces it.     */
/*  No transcript on game rounds — the guess is by EAR (the screenshots drop   */
/*  it deliberately).                                                          */
/*                                                                            */
/*  The small toggle: GAME (default) / VOICE ALBUM (founder 2026-08-14:      */
/*  the best-voices tab IS the Voice Album — renamed; the data source        */
/*  upgrades to the three-way album endpoint next). Same design minus the    */
/*  design minus the dilemma: quote card, the same playback hero, ONE comment  */
/*  below (the coach's note OVERRIDES the system's — never both) plus the      */
/*  coach's video when attached, and neutral black Back / Next.                */
/*                                                                            */
/*  The game stays MOUNTED while toggled away: unmounting would drop the       */
/*  verdicts and invite re-answers, which append junk peer labels (N3).       */
/*  Truth is never in the rounds payload (N1) — rounds render identically.     */
/*  No scores, no streaks, no tallies (N2); the dots are position, not a       */
/*  tally. A decoy reveal reads neutral (N5). All copy → founder sign-off.     */
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
          Voice-game
        </h1>
        <OverlayCloseButton onClick={() => router.push("/chat")} />
      </div>

      {/* The small mode toggle — Game is the default state by design. */}
      <div className="flex shrink-0 justify-center px-5 pt-2">
        <ModeToggle
          value={tab}
          options={[
            { value: "game", label: "Game" },
            { value: "voice", label: "Voice album" },
          ]}
          onChange={setTab}
        />
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col px-5 pt-3 ${SCREEN_BOTTOM_GAP}`}
      >
        {/* The game keeps its state while hidden: an unmount would forget the
            answered rounds, and a re-answer is a duplicate peer label (N3). */}
        <div
          className={tab === "game" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
        >
          {status === "loading" ? (
            <Centered>
              <VoiceMark size={48} />
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
            <GameView arcId={arcId!} session={session} />
          )}
        </div>

        {tab === "voice" ? <BestVoices arcId={arcId} /> : null}
      </div>
    </main>
  );
}

/* ────────────────────────────── shared chrome ────────────────────────────── */

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center">{children}</div>
  );
}

/* The small two-state pill with the sliding black thumb now lives in
   src/components/willab/ModeToggle.tsx (shared — founder rule: one toggle
   style everywhere, this screen is the reference). */

/** Position dots (position, not a tally — N2): current is the wide one. */
function ProgressDots({ total, index }: { total: number; index: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ease-out ${
            i === index
              ? "w-6 bg-foreground"
              : i < index
                ? "w-1.5 bg-foreground"
                : "w-1.5 bg-border"
          }`}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────── the playback hero ───────────────────────────── */

/** Real clamped audio for the hero: plays exactly the snippet's slice of the
 *  take's file (the same clamp MediaPlayer uses), surfaced as one big central
 *  button — it is tapped every round, so it is large and comfortable. */
function useClampedAudio(
  src: string | null,
  startOffsetMs: number,
  durationMs: number
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 within the slice
  const [errored, setErrored] = useState(false);
  const seekSec = startOffsetMs / 1000;
  const clipSec = durationMs > 0 ? durationMs / 1000 : null;

  useEffect(() => {
    setErrored(false);
    setPlaying(false);
    setProgress(0);
  }, [src, startOffsetMs, durationMs]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el || errored || !src) return;
    if (playing) {
      el.pause();
      return;
    }
    const end = clipSec !== null ? seekSec + clipSec : null;
    if (el.currentTime < seekSec || (end !== null && el.currentTime >= end)) {
      el.currentTime = seekSec;
    }
    void el.play().catch(() => setErrored(true));
  };

  const onTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    const total = clipSec ?? (el.duration || 0) - seekSec;
    if (total <= 0) return;
    const p = Math.min(1, Math.max(0, (el.currentTime - seekSec) / total));
    setProgress(p);
    if (clipSec !== null && el.currentTime >= seekSec + clipSec) {
      el.pause();
      el.currentTime = seekSec;
      setProgress(0);
    }
  };

  const element = (
    <audio
      ref={audioRef}
      src={src ?? undefined}
      preload="metadata"
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => {
        setPlaying(false);
        setProgress(0);
      }}
      onTimeUpdate={onTimeUpdate}
      onLoadedMetadata={() => {
        const el = audioRef.current;
        if (el && seekSec > 0) el.currentTime = seekSec;
      }}
      onError={() => setErrored(true)}
      className="hidden"
    />
  );

  return { playing, progress, errored, toggle, element };
}

function Waveform({ progress, active }: { progress: number; active: boolean }) {
  const bars = useMemo(
    () =>
      Array.from(
        { length: 40 },
        (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 1.3) * Math.cos(i * 0.7))
      ),
    []
  );
  return (
    <div className="flex h-12 items-center justify-center gap-[3px]" aria-hidden>
      {bars.map((h, i) => {
        const on = active && i / bars.length <= progress;
        return (
          <span
            key={i}
            className={`w-[3px] rounded-full transition-colors ${
              on ? "bg-foreground" : "bg-border"
            }`}
            style={{ height: `${Math.max(6, h * 40)}px` }}
          />
        );
      })}
    </div>
  );
}

function PlaybackHero({
  src,
  startOffsetMs,
  durationMs,
}: {
  src: string | null;
  startOffsetMs: number;
  durationMs: number;
}) {
  const audio = useClampedAudio(src, startOffsetMs, durationMs);
  return (
    <div className="shrink-0 rounded-3xl border border-border bg-card p-6">
      {audio.element}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={audio.toggle}
          disabled={!src || audio.errored}
          aria-label={audio.playing ? "Pause" : "Play"}
          className="grid h-20 w-20 place-items-center rounded-full bg-foreground text-background shadow-lg transition-transform active:scale-95 disabled:opacity-40"
        >
          {audio.playing ? (
            <Pause className="h-8 w-8" aria-hidden />
          ) : (
            <Play className="ml-1 h-8 w-8" aria-hidden />
          )}
        </button>
        <Waveform
          progress={audio.progress}
          active={audio.playing || audio.progress > 0}
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────── the game ───────────────────────────────── */

function GameView({ arcId, session }: { arcId: string; session: GameSession }) {
  const [verdicts, setVerdicts] = useState<Record<string, GameVerdict>>({});
  // What the user CALLED it — drives which button tints on the reveal.
  const [picks, setPicks] = useState<Record<string, TernaryValue>>({});
  const [current, setCurrent] = useState(0);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState<TernaryValue | null>(null);
  const [failed, setFailed] = useState(false);
  // N3 — one POST per decision, enforced SYNCHRONOUSLY. State alone is not a
  // guard: two clicks in the same tick both read it before React commits,
  // and each answer persists as a peer label server-side.
  const inFlightRef = useRef(false);

  if (finished) {
    return <EndScreen arcId={arcId} gameSessionId={session.gameSessionId} />;
  }

  const round = session.rounds[current];
  const verdict = verdicts[round.roundId] ?? null;
  const pick = picks[round.roundId];
  const isLast = current === session.rounds.length - 1;

  async function answer(value: TernaryValue) {
    if (inFlightRef.current || verdict) return;
    inFlightRef.current = true;
    setFailed(false);
    setSubmitting(value);
    const v = await submitGameAnswer(arcId, round.roundId, value);
    setSubmitting(null);
    if (v) {
      setPicks((p) => ({ ...p, [round.roundId]: value }));
      setVerdicts((prev) => ({ ...prev, [round.roundId]: v }));
      inFlightRef.current = false;
    } else {
      // Only a FAILED post re-arms the chips — a success keeps the round
      // answered forever (the label is already in the corpus).
      inFlightRef.current = false;
      setFailed(true);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-end">
        <ProgressDots total={session.rounds.length} index={current} />
      </div>

      <h2 className="shrink-0 text-center text-[22px] font-semibold tracking-tight text-foreground">
        Does this sound confident?
      </h2>

      <PlaybackHero
        key={round.roundId}
        src={round.audioRef}
        startOffsetMs={round.startOffsetMs}
        durationMs={round.durationMs}
      />

      {/* THE shared instrument (founder 2026-08-10: "the confident voice
          label should has the same UI as the coach based labelling and the
          voice game labelling" — and the missing third answer). The h2
          above is the question, so the component's own line is hidden; the
          outcome shows in the reveal below (N5 holds — never red, and an
          Ambiguous answer gets a reveal with no win/lose head at all). */}
      <div className="shrink-0 self-center">
        <ConfidenceLabelChips
          question={null}
          value={pick ?? null}
          disabled={submitting !== null || !!verdict}
          saving={submitting !== null}
          onPick={(v) => void answer(v)}
        />
      </div>

      {failed ? (
        <p className="shrink-0 text-center text-[13px] text-muted-foreground">
          Couldn&apos;t check that one. Tap your answer again.
        </p>
      ) : null}

      {verdict ? (
        <>
          <RevealBlock verdict={verdict} />
          <button
            type="button"
            onClick={() =>
              isLast ? setFinished(true) : setCurrent((c) => c + 1)
            }
            className="shrink-0 self-center rounded-full bg-foreground px-8 py-2.5 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            {isLast ? "Finish" : "Next"}
          </button>
        </>
      ) : null}
    </div>
  );
}

/** The short explanation below the dilemma — inside the same screen.
 *
 *  Founder 2026-07-28: the verdict has NO line of its own. It is the bold
 *  head of the comment itself — "**Correct** 🥳 The load-bearing words…" —
 *  with the emoji ONLY on a correct call: a wrong call is usually the user
 *  hearing their own solid moment as a key one, and celebrating that back at
 *  them would be as wrong as scolding it (N5).
 *
 *  ONE comment, the same rule as Best voices: the served `why` IS the
 *  comment, so the neutral truth line ("this one was solid…") is the head's
 *  tail only when the BE served no why at all — never a second paragraph
 *  saying the same thing twice. */
function RevealBlock({ verdict }: { verdict: GameVerdict }) {
  const paragraphs = verdict.why.slice(0, 3);
  const truthLine =
    verdict.truthIsKey === null
      ? null
      : verdict.truthIsKey
        ? "This was one of your key moments."
        : "This one was solid — not a key moment.";
  // The head carries the comment's first paragraph; the truth line stands in
  // only when there is no comment to carry.
  const head = paragraphs[0] ?? truthLine ?? "";
  const rest = paragraphs.slice(1);

  const tinted = (text: string) =>
    splitTintedSegments(text).map((seg, j) =>
      seg.tinted ? (
        <span key={j} className="font-medium text-primary">
          {seg.text}
        </span>
      ) : (
        <span key={j}>{seg.text}</span>
      )
    );

  return (
    <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto px-1 scrollbar-none">
      {/* Qualitative only (N2) — a word and the why, never a tally. An
          Ambiguous answer has NO verdict (correct === null): the reveal
          carries the read alone, with no win/lose head — there is nothing
          to be right or wrong about on an abstained guess. */}
      <p className="text-[14px] leading-relaxed text-foreground">
        {verdict.correct !== null ? (
          <>
            <span className="font-semibold">
              {verdict.correct ? "Correct" : "Not quite"}
            </span>
            {verdict.correct ? " 🥳" : ""}{" "}
          </>
        ) : null}
        {tinted(head)}
      </p>
      {rest.map((p, i) => (
        <p key={i} className="text-[14px] leading-relaxed text-foreground">
          {tinted(p)}
        </p>
      ))}
      {verdict.videoRef ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={verdict.videoRef}
          controls
          playsInline
          className="mt-1 max-h-[24vh] w-full shrink-0 rounded-2xl bg-black"
        />
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
          coach's current truth: "practice this talk again", never "resume". */}
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

/* ── BEST VOICES — same design, no dilemma: the explanation is already there ── */

function BestVoices({ arcId }: { arcId: string | null }) {
  // THE VOICE ALBUM (founder 2026-08-14): this tab reads the three-way
  // album — moments where the acoustic read, the student, and the coach
  // all agreed (BE #431, a mirror of current alignment) — instead of the
  // coach-only breakthrough list it grew up on. Same design: hero, one
  // text block, neutral steppers, dots as position.
  const [items, setItems] = useState<VoiceAlbumEntry[] | null>(null);
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
    void fetchVoiceAlbum(arcId).then((list) => {
      if (!active) return;
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
        <VoiceMark size={48} />
      </Centered>
    );
  }
  if (status === "empty" || !items || items.length === 0) {
    // Founder-signed empty state (2026-08-14).
    return (
      <Centered>
        <div className="max-w-sm text-center">
          <p className="text-[15px] font-semibold text-foreground">
            Your Voice Album is empty.
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
            When you lock a &lsquo;Confident Voice&rsquo; moment and your
            coach publishes the deck, your standout deliveries will be
            saved here.
          </p>
        </div>
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

  const idx = Math.min(i, items.length - 1);
  const item = items[idx];
  // The album shows the moment's own VERBATIM words under the sound.
  const comment = item.text;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Founder 2026-07-28 — no quote card and no "Your best · N/M" label
          here. The moment is the SOUND: the hero and the comment are the
          whole screen, and the dots already say where you are. Reading the
          line first would also pre-frame the ear, which is the one thing
          this tab exists to train. */}
      <div className="flex shrink-0 items-center justify-end">
        <ProgressDots total={items.length} index={idx} />
      </div>

      {item.audioUrl ? (
        <PlaybackHero
          key={item.snippetId}
          src={item.audioUrl}
          startOffsetMs={item.startOffsetMs ?? 0}
          durationMs={item.durationMs ?? 0}
        />
      ) : null}

      {/* The explanation is already there — the same block as the game's. */}
      <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto px-1 scrollbar-none">
        {comment ? (
          <p className="text-[14px] leading-relaxed text-foreground">
            {comment}
          </p>
        ) : null}
      </div>

      {/* Neutral black steppers, centered — no dilemma here. */}
      <div className="mt-auto flex shrink-0 items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => setI((n) => Math.max(0, n - 1))}
          disabled={idx === 0}
          className="inline-flex min-w-[130px] items-center justify-center gap-1.5 rounded-2xl bg-foreground/70 px-6 py-3.5 text-[14px] font-semibold text-background transition-transform active:scale-95 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Back
        </button>
        <button
          type="button"
          onClick={() => setI((n) => Math.min(items.length - 1, n + 1))}
          disabled={idx >= items.length - 1}
          className="inline-flex min-w-[130px] items-center justify-center gap-1.5 rounded-2xl bg-foreground px-6 py-3.5 text-[14px] font-semibold text-background transition-transform active:scale-95 disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
