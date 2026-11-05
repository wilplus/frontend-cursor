"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useVoiceNote, clock } from "./useVoiceNote";
import { answerNotebook, sendVoiceNote } from "@/services/api/voiceNotebook";
import { dropNote, type OutboxNote } from "@/lib/willab/voiceNoteOutbox";
import { tapHaptic } from "@/lib/phone/haptic";
import {
  DUMP_COPY as COPY,
  SWIPE_CLOSE_PX,
  countKept,
  freshMemory,
  readTap,
  showHint,
  type TapMemory,
} from "@/lib/willab/dumpScreen";

/* -------------------------------------------------------------------------- */
/*  The dump screen (backend N506, N507): one screen that only listens. Tap   */
/*  anywhere to start, tap to stop and keep, double tap to close; the × and a */
/*  swipe down close too. What is said is a voice note in the notebook        */
/*  (N194): the same recorder, outbox and upload as the notebook, so closing  */
/*  the app mid-sentence keeps it.                                            */
/*                                                                            */
/*  The first time, before it listens, it shows N411's introduction once:     */
/*  Yes is the notebook's consent; Not now closes it and turns the switch off */
/*  (N507 item 1). The rules of the taps: lib/willab/dumpScreen.ts.           */
/* -------------------------------------------------------------------------- */

const MAX_SECONDS = 300;

export default function DumpScreen({
  needsConsent,
  onClose,
  onDecline,
}: {
  /** The notebook has no Yes yet: the introduction comes first. */
  needsConsent: boolean;
  /** Closed; `kept` when something was kept, for the "Kept" that follows. */
  onClose: (kept: boolean) => void;
  /** "Not now" to the introduction. */
  onDecline: () => void;
}) {
  const [asking, setAsking] = useState(needsConsent);
  const [kept, setKept] = useState(false);
  const [hint] = useState(showHint);
  const keptAny = useRef(false);
  const memory = useRef<TapMemory>(freshMemory(Date.now()));
  const down = useRef<{ x: number; y: number; size: number; fingers: number } | null>(null);
  const fingers = useRef(0);
  const [drag, setDrag] = useState(0);

  const send = useCallback(async (note: OutboxNote) => {
    const out = await sendVoiceNote(note.audio, note.durationMs, note.key, note.liveMs);
    // A note that can't go now waits in the outbox; the notebook sends it
    // when the app is open with a connection.
    if (out.kind !== "retry") await dropNote(note.key);
  }, []);

  const note = useVoiceNote({
    maxSeconds: MAX_SECONDS,
    notebook: true,
    onDone: async (done) => {
      void send(done);
    },
  });
  const listening = note.phase === "recording";

  const keep = useCallback(() => {
    note.send();
    countKept();
    keptAny.current = true;
    setKept(true);
  }, [note]);

  const close = useCallback(() => {
    if (note.phase === "recording") keep();
    tapHaptic();
    window.setTimeout(tapHaptic, 90);
    onClose(keptAny.current);
  }, [note.phase, keep, onClose]);

  // Escape closes, as × does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // The guard against the tap that opened the screen starts when it listens.
  useEffect(() => {
    if (!asking) memory.current = freshMemory(Date.now());
  }, [asking]);

  function tap(x: number, y: number, d: { x: number; y: number; size: number; fingers: number }) {
    const [action, next] = readTap(
      memory.current,
      { at: Date.now(), x, y, downX: d.x, downY: d.y, size: d.size, multi: d.fingers > 1 },
      listening,
    );
    memory.current = next;
    if (action.kind === "start") {
      setKept(false);
      void note.start();
    } else if (action.kind === "stop") {
      keep();
      tapHaptic();
    } else if (action.kind === "close") {
      if (action.undoStart) note.cancel();
      close();
    }
  }

  async function answer(choice: "yes" | "not_now") {
    if (choice === "not_now") {
      void answerNotebook("not_now", "dump_screen");
      onDecline();
      return;
    }
    if (await answerNotebook("yes", "dump_screen")) setAsking(false);
  }

  if (asking) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col bg-background" role="dialog" aria-modal="true">
        <CloseButton onClose={() => onDecline()} />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-6">
          <p className="text-[15px] leading-relaxed">{COPY.introLead}</p>
          <div className="rounded-2xl bg-muted px-4 py-3 text-[14px] leading-relaxed text-muted-foreground">
            {COPY.introNote.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p className="text-[15px] leading-relaxed">{COPY.introAsk}</p>
        </div>
        <div className="mx-auto flex w-full max-w-md gap-2 px-4 pb-6">
          <button type="button" className="h-12 flex-1 rounded-full border border-border text-[15px] font-medium" onClick={() => void answer("not_now")}>
            {COPY.notNow}
          </button>
          <button type="button" className="h-12 flex-1 rounded-full bg-foreground text-[15px] font-medium text-background" onClick={() => void answer("yes")}>
            {COPY.yes}
          </button>
        </div>
      </div>
    );
  }

  const title = listening ? COPY.listening : kept ? `${COPY.kept}.` : COPY.idle;
  const sub = listening ? COPY.tapToStop : kept ? COPY.tapToSayMore : COPY.idleHint;
  const words = note.words.map((w) => w.text).join(" ");

  return (
    <div
      // `touch-none`: the screen reads every touch itself. With panning
      // allowed, a phone takes a downward drag for its own (the page's
      // bounce, Safari's pull to reload) and cancels it after a few pixels,
      // so the swipe down that closes (N506 item 2) never reached 90 px.
      className="fixed inset-0 z-[80] touch-none select-none bg-background"
      style={{ transform: drag ? `translateY(${drag}px)` : undefined }}
      role="button"
      tabIndex={0}
      aria-label={listening ? COPY.tapToStop : COPY.idleHint}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (listening) keep();
          else void note.start();
        }
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-dump-close]")) return;
        fingers.current += 1;
        down.current = { x: e.clientX, y: e.clientY, size: Math.max(e.width, e.height), fingers: fingers.current };
      }}
      onPointerMove={(e) => {
        const d = down.current;
        if (d && e.clientY - d.y > 8) setDrag(Math.min(e.clientY - d.y, 200));
      }}
      onPointerUp={(e) => {
        fingers.current = Math.max(0, fingers.current - 1);
        const d = down.current;
        down.current = null;
        setDrag(0);
        if (!d) return;
        if (e.clientY - d.y > SWIPE_CLOSE_PX) {
          close();
          return;
        }
        tap(e.clientX, e.clientY, d);
      }}
      onPointerCancel={() => {
        fingers.current = 0;
        down.current = null;
        setDrag(0);
      }}
    >
      <CloseButton onClose={close} />
      <div className="pointer-events-none absolute inset-x-0 bottom-[90px] top-0 flex flex-col items-center justify-center gap-[18px] px-7 text-center">
        <Mark state={listening ? "listening" : kept ? "kept" : "idle"} />
        <p className={`text-[22px] font-semibold tracking-tight ${kept && !listening ? "text-[hsl(var(--affirm))]" : ""}`}>{title}</p>
        <p className="-mt-2.5 text-[14px] text-muted-foreground">{sub}</p>
      </div>
      {words ? (
        <p className="pointer-events-none absolute inset-x-[22px] bottom-[96px] line-clamp-4 text-[15px] leading-relaxed text-foreground/80">{words}</p>
      ) : null}
      <div className="pointer-events-none absolute inset-x-3.5 bottom-[max(22px,env(safe-area-inset-bottom))] flex h-[50px] items-center gap-3 rounded-2xl bg-muted px-4">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${listening ? "animate-pulse bg-[hsl(var(--record))]" : "bg-[hsl(var(--record))]/40"}`}
          aria-hidden
        />
        <span className="font-mono text-[16px] font-semibold tabular-nums">{clock(note.elapsedMs)}</span>
        {hint && !listening ? <span className="truncate text-[12.5px] text-muted-foreground">{COPY.doubleTapToClose}</span> : null}
      </div>
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      data-dump-close
      aria-label="Close"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      // Drawn 30px; its tap area is 44px (the invisible `before:`). Here a
      // thumb that misses the × lands on the screen, which starts listening.
      className="absolute right-4 top-[max(20px,env(safe-area-inset-top))] z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full border border-border bg-background text-foreground before:absolute before:-inset-[7px] before:content-['']"
    >
      <X className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

/** The mic-ready mark (the recording screen's): three dots in a soft ring.
 *  The dots move while it listens. */
function Mark({ state }: { state: "idle" | "listening" | "kept" }) {
  const ring =
    state === "listening"
      ? "border-[hsl(var(--record))]/45"
      : state === "kept"
        ? "border-[hsl(var(--affirm))]/40"
        : "border-[hsl(var(--primary))]/25";
  return (
    <div className={`flex h-[108px] w-[108px] items-center justify-center rounded-full border-[1.5px] ${ring}`} aria-hidden>
      <svg width="30" height="30" viewBox="0 0 22 22" className="text-foreground/80">
        {[
          [3, 2.2, 0],
          [11, 3.2, 150],
          [19, 2.2, 300],
        ].map(([cx, r, delay]) => (
          <circle
            key={cx}
            cx={cx}
            cy="11"
            r={r}
            fill="currentColor"
            className={state === "listening" ? "animate-voice-dot" : undefined}
            style={state === "listening" ? { animationDelay: `${delay}ms`, transformBox: "fill-box", transformOrigin: "center" } : undefined}
          />
        ))}
      </svg>
    </div>
  );
}
