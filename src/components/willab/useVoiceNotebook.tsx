"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Clock, Mic, Send, Trash2, X } from "lucide-react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import SymmetricPair from "./SymmetricPair";
import {
  answerNotebook,
  answerSunday,
  askNotebook,
  fixVoiceNote,
  getNotebookState,
  sendVoiceNote,
  type NotebookState,
  type SundayChoice,
} from "@/services/api/voiceNotebook";
import type { OfferType } from "./loungeOffers";
import { clock, useVoiceNote } from "./useVoiceNote";
import { dropNote, waitingNotes, type OutboxNote } from "@/lib/willab/voiceNoteOutbox";
import { wordsOf, type LiveWord } from "@/lib/willab/liveNoteWords";
import TypingDots, { TypingGlyph } from "./TypingDots";

/* -------------------------------------------------------------------------- */
/*  useVoiceNotebook — the founder's voice notebook in the Lounge (Will        */
/*  learning plan, step 1; founder 2026-10-20). Only for whom the backend      */
/*  says it is on (ring 6). The mic sits right of the message box while it is */
/*  empty; before the first note "Keep a voice notebook?" opens Yes | Not now */
/*  while it is the newest message. Backend: services/voice_notebook.py.      */
/*                                                                            */
/*  Written as it is said (backend N194): the note grows in the thread while  */
/*  it is said; on send it settles, then a tick under it and "Noted.". A note */
/*  that cannot leave the phone waits in the outbox under a clock and goes    */
/*  when the app is open with a connection. A tap on one's own note opens its */
/*  words to fix one.                                                         */
/* -------------------------------------------------------------------------- */

export function useVoiceNotebook({
  signedIn,
  threadLoading,
  drawn,
  openOffer,
  reload,
}: {
  signedIn: boolean;
  threadLoading: boolean;
  drawn: readonly Pick<LoungeMessage, "client_id" | "metadata">[];
  openOffer: (type: OfferType) => void;
  reload: () => Promise<unknown>;
}) {
  const [state, setState] = useState<NotebookState | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void getNotebookState().then((next) => live && setState(next));
    return () => {
      live = false;
    };
  }, [signedIn]);

  // "Keep a voice notebook?", and the Sunday note's two asks (step 2), open
  // their pair while they are the newest message, once each.
  const askRef = useRef<string | null>(null);
  useEffect(() => {
    if (threadLoading) return;
    const last = drawn[drawn.length - 1];
    const offer = OWN_ASKS.find((type) => type === last?.metadata?.offer);
    if (!last || !offer || askRef.current === last.client_id) return;
    askRef.current = last.client_id;
    openOffer(offer);
  }, [threadLoading, drawn, openOffer]);

  // The outbox: notes kept on the phone until the backend has them. Sent one
  // at a time, oldest first; a note that cannot go waits under its clock.
  const [waiting, setWaiting] = useState<OutboxNote[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [offline, setOffline] = useState<Set<string>>(new Set());
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [settling, setSettling] = useState<string | null>(null);
  const flushingRef = useRef(false);
  // The note being said right now: the recorder below fills it in, and the
  // flush leaves that note alone.
  const currentKeyRef = useRef<() => string>(() => "");
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const againRef = useRef(false);
  const flush = useCallback(async () => {
    if (flushingRef.current) {
      againRef.current = true; // a note arrived mid-flush: one more round
      return;
    }
    flushingRef.current = true;
    try {
      const saying = currentKeyRef.current();
      const notes = (await waitingNotes()).filter((n) => n.key !== saying);
      setWaiting(notes);
      for (const n of notes) {
        setSending(n.key);
        const outcome = await sendVoiceNote(n.audio, n.durationMs, n.key);
        if (outcome.kind === "retry") {
          setOffline((now) => new Set(now).add(n.key));
          break; // the connection is gone: the rest wait too
        }
        await dropNote(n.key);
        if (outcome.kind === "kept" && outcome.clientId) {
          const id = outcome.clientId;
          setKept((now) => new Set(now).add(id));
        }
        // Kept: the hesitations fade out, then the kept note takes its place
        // with the tick and "Noted." (N198).
        if (outcome.kind === "kept") {
          setSettling(n.key);
          await new Promise((done) => setTimeout(done, SETTLE_MS));
        }
        await reloadRef.current();
        setSettling(null);
        setWaiting((now) => now.filter((w) => w.key !== n.key));
        setOffline((now) => {
          const next = new Set(now);
          next.delete(n.key);
          return next;
        });
      }
    } finally {
      setSending(null);
      flushingRef.current = false;
      if (againRef.current) {
        againRef.current = false;
        void flush();
      }
    }
  }, []);

  const note = useVoiceNote({
    maxSeconds: state?.max_seconds ?? 300,
    notebook: true,
    onDone: async (done) => {
      setWaiting((now) => (now.some((w) => w.key === done.key) ? now : [...now, done]));
      await flush();
    },
  });

  currentKeyRef.current = note.currentKey;

  // Notes left by a closed app, or by a lost connection, go when the app is
  // open and online again.
  useEffect(() => {
    if (!state?.consented) return;
    void flush();
    const again = () => {
      if (document.visibilityState === "visible") void flush();
    };
    window.addEventListener("online", again);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.removeEventListener("online", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, [state?.consented, flush]);

  // Fixing a note's words (N194): the note's row, and the words in the box.
  const [fixing, setFixing] = useState<{ clientId: string; draft: string } | null>(null);
  async function saveFix(): Promise<void> {
    if (!fixing) return;
    const words = fixing.draft.replace(/^#\s*/, "").trim();
    if (!words) return;
    if (await fixVoiceNote(fixing.clientId, words)) {
      setFixing(null);
      await reload();
    }
  }

  async function tapMic(): Promise<void> {
    if (state?.consented) {
      void note.start();
      return;
    }
    if (await askNotebook()) await reload();
    openOffer("voice_notebook");
  }

  // The Sunday note an Old | New or Add principle tap is about: the newest
  // bubble carrying that ask.
  async function sunday(choice: SundayChoice): Promise<void> {
    const step = choice === "old" || choice === "new" ? "pattern" : "principle";
    const offer = step === "pattern" ? "sunday_note" : "sunday_principle";
    const ask = [...drawn].reverse().find((m) => m.metadata?.offer === offer);
    const noteId = ask?.metadata?.sunday_note_id;
    if (typeof noteId !== "string") return;
    if (await answerSunday(noteId, step, choice)) await reload();
  }

  async function answer(choice: "yes" | "not_now"): Promise<void> {
    if (!(await answerNotebook(choice))) return;
    if (choice === "yes") setState((now) => (now ? { ...now, consented: true } : now));
    await reload();
  }

  return {
    enabled: state?.enabled === true,
    note,
    recording: note.phase === "recording",
    /** The message box's display: it gives way to the recording bar, and to
     *  a note's words while they are fixed. */
    composerDisplay: note.phase === "recording" || fixing ? "hidden" : "flex",
    /** Notes on the phone, not yet kept; the one on its way; those waiting
     *  for a connection; the notes kept since the Lounge opened. */
    waiting,
    sending,
    offline,
    kept,
    /** The note whose hesitations are fading out, just kept. */
    settling,
    fixing,
    /** A tap on one's own voice note: its words into the box to fix. */
    fix: (clientId: string, body: string) => setFixing({ clientId, draft: body.replace(/^#\s*/, "") }),
    editFix: (draft: string) => setFixing((now) => (now ? { ...now, draft } : now)),
    closeFix: () => setFixing(null),
    saveFix: () => void saveFix(),
    tapMic: () => void tapMic(),
    answer: (choice: "yes" | "not_now") => void answer(choice),
    sunday: (choice: SundayChoice) => void sunday(choice),
  };
}

export type VoiceNotebook = ReturnType<typeof useVoiceNotebook>;

/** How long the hesitations take to fade once a note is kept. */
const SETTLE_MS = 700;

const OWN_ASKS: readonly OfferType[] = ["voice_notebook", "sunday_note", "sunday_principle", "life_goals", "life_goals_quarter", "life_goals_change"];

/** The Sunday note's footer (founder's form, 2026-10-20): Old | New for the
 *  week's bug, then Not now | Add principle for Will's new principle. */
export function SundayActions({
  type,
  onSunday,
  onResolve,
}: {
  type: "sunday_note" | "sunday_principle";
  onSunday: (choice: SundayChoice) => void;
  onResolve: () => void;
}) {
  const pick = (choice: SundayChoice) => () => {
    onSunday(choice);
    onResolve();
  };
  return type === "sunday_note" ? (
    <SymmetricPair closeLabel="Old" onClose={pick("old")} actionLabel="New" onAction={pick("new")} />
  ) : (
    <SymmetricPair closeLabel="Not now" onClose={pick("not_now")} actionLabel="Add principle" onAction={pick("add")} />
  );
}

/** The mic, right of the message box: only where the notebook is on and the
 *  box is empty. A note on its way never holds it: the outbox sends notes
 *  one after another (N194). */
export function VoiceNoteMic({ notebook, draft }: { notebook: VoiceNotebook; draft: string }) {
  if (!notebook.enabled || draft.trim()) return null;
  return (
    <button
      type="button"
      onClick={notebook.tapMic}
      aria-label="Voice note"
      data-testid="voice-note-mic"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
    >
      <Mic className="h-5 w-5" aria-hidden />
    </button>
  );
}

/** The note on its way (founder 2026-10-20, "exactly like WhatsApp"): trash
 *  on the left, the running time, send on the right. */
export function VoiceNoteBar({ notebook }: { notebook: VoiceNotebook }) {
  if (!notebook.recording) return null;
  return (
    <div className="flex items-center gap-1" data-testid="voice-note-recording">
      <button
        type="button"
        onClick={notebook.note.cancel}
        aria-label="Delete"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
      >
        <Trash2 className="h-5 w-5" aria-hidden />
      </button>
      <div className="flex h-10 flex-1 items-center gap-2 rounded-3xl border border-border bg-background px-3.5 text-[15px] tabular-nums">
        <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
        {clock(notebook.note.elapsedMs)}
      </div>
      <button
        type="button"
        onClick={notebook.note.send}
        aria-label="Send"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
      >
        <Send className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

/** The note while it is said, then the notes on the phone not yet kept,
 *  then Will's typing dots while one is on its way (backend N194, N198).
 *  The wave comes first and the words follow it: the words replace the wave
 *  they cover, and the wave they have not reached stays at the end. Sits at
 *  the bottom of the thread. */
export function VoiceNoteThread({ notebook }: { notebook: VoiceNotebook }) {
  const { note, waiting, sending, offline, settling } = notebook;
  const live = note.phase === "recording";
  const endRef = useRef<HTMLDivElement | null>(null);
  const growth = note.words.length + Math.floor(note.wave.length / 20);
  useEffect(() => {
    if (live || waiting.length) endRef.current?.scrollIntoView?.({ block: "end" });
  }, [live, growth, waiting.length]);
  if (!live && !waiting.length) return null;
  return (
    <>
      {waiting.map((w) => {
        const settles = settling === w.key;
        const waits = offline.has(w.key) && sending !== w.key;
        return (
          <div key={w.key} className="ml-auto flex max-w-[85%] flex-col items-end gap-1" data-testid="voice-note-waiting">
            <div className="whitespace-pre-wrap break-words rounded-2xl bg-primary px-3 py-2 text-[15px] text-primary-foreground">
              {"# "}
              <NoteWords words={wordsOf(w.words)} settling={settles} />
              {settles ? null : <Wave levels={w.tail ?? []} waiting={!waits} />}
            </div>
            {waits ? <Clock className="mr-1 h-3.5 w-3.5 text-muted-foreground" aria-label="Waiting to send" role="img" /> : null}
          </div>
        );
      })}
      {live ? (
        <div
          className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-3 py-2 text-[15px] text-primary-foreground"
          data-testid="voice-note-live"
        >
          {"# "}
          <NoteWords words={note.words} settling={false} />
          <Wave levels={note.wave.map((b) => b.level)} waiting={false} live />
        </div>
      ) : null}
      {sending && !offline.has(sending) ? <TypingDots /> : null}
      <div ref={endRef} />
    </>
  );
}

/** The note's words: the piece still being heard lighter; on settling, the
 *  hesitations fade out with a line through them. */
function NoteWords({ words, settling }: { words: readonly LiveWord[]; settling: boolean }) {
  return (
    <>
      {words.map((w, i) => (
        <span
          key={i}
          className={`transition-opacity duration-300 ${
            settling ? (w.filler ? "line-through opacity-25" : "") : w.fresh ? "opacity-70" : ""
          }`}
        >
          {w.text}{" "}
        </span>
      ))}
    </>
  );
}

/** Bars shown at most: about five seconds of voice, which is the most the
 *  words fall behind. */
const WAVE_BARS = 34;

/** The voice the words have not reached yet: one bar per 140 ms, its height
 *  the mic's level. While the note is said, the newest bar is now; after
 *  send, the bars shimmer while Will writes them down (N198). */
function Wave({ levels, waiting, live = false }: { levels: readonly number[]; waiting: boolean; live?: boolean }) {
  const bars = levels.slice(-WAVE_BARS);
  // At the very start of a note there is no level yet: three quiet bars, so
  // the note shows at once that it is listening.
  const shown = live && bars.length < 3 ? [...bars, ...Array(3 - bars.length).fill(0.1)] : bars;
  if (!shown.length) return null;
  return (
    <span
      aria-hidden
      data-testid="voice-note-wave"
      className={`ml-0.5 inline-flex h-[18px] translate-y-[3px] items-center gap-[2px] ${waiting ? "animate-pulse" : ""}`}
    >
      {shown.map((level, i) => (
        <span key={i} className="w-[3px] rounded-full bg-primary-foreground" style={{ height: `${4 + Math.round(level * 14)}px` }} />
      ))}
    </span>
  );
}

/** A voice note's words in the box to fix one (backend N194): close on the
 *  left, the words, send on the right. Will does not answer again. */
export function VoiceNoteFixBar({ notebook }: { notebook: VoiceNotebook }) {
  const fixing = notebook.fixing;
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const open = fixing !== null;
  useEffect(() => {
    if (open) boxRef.current?.focus();
  }, [open]);
  if (!fixing) return null;
  return (
    <div className="flex items-end gap-1" data-testid="voice-note-fix">
      <button
        type="button"
        onClick={notebook.closeFix}
        aria-label="Close"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
      <textarea
        ref={boxRef}
        rows={3}
        value={fixing.draft}
        onChange={(e) => notebook.editFix(e.target.value)}
        aria-label="Message Will"
        autoCorrect="on"
        autoCapitalize="sentences"
        spellCheck
        className="scrollbar-none block max-h-40 min-h-[40px] flex-1 resize-none overflow-x-hidden rounded-3xl border border-primary bg-background px-3.5 py-2 text-[15px] leading-snug outline-none"
      />
      <button
        type="button"
        onClick={notebook.saveFix}
        disabled={!fixing.draft.trim()}
        aria-label="Send"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
      >
        <ArrowUp className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

/** One's own voice note in the thread: a tap opens its words to fix one;
 *  the tick under it once kept in this sitting (backend N194). */
export function VoiceNoteBubble({
  body,
  clientId,
  notebook,
  children,
}: {
  body: string;
  clientId: string;
  notebook: VoiceNotebook;
  children: React.ReactNode;
}) {
  return (
    <div className="ml-auto flex max-w-[85%] flex-col items-end gap-1">
      <button
        type="button"
        data-row="me"
        data-bubble=""
        onClick={() => notebook.fix(clientId, body)}
        aria-label="Fix this note"
        className="whitespace-pre-wrap break-words rounded-2xl bg-primary px-3 py-2 text-left text-[15px] text-primary-foreground"
      >
        {children}
      </button>
      {notebook.kept.has(clientId) ? (
        <Check className="mr-1 h-3.5 w-3.5 text-muted-foreground" aria-label="Kept" role="img" />
      ) : null}
    </div>
  );
}
