"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock, Send, X } from "lucide-react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { TapRow } from "./WillQuestion";
import {
  answerNotebook,
  answerSalesStep,
  fixVoiceNote,
  getNotebookState,
  sendVoiceNote,
  type NotebookState,
  type SalesStep,
} from "@/services/api/voiceNotebook";
import type { OfferType } from "./loungeOffers";
import { useVoiceNote } from "./useVoiceNote";
import RecordingBar from "./RecordingBar";
import { dropNote, outboxOwner, waitingNotes, type OutboxNote } from "@/lib/willab/voiceNoteOutbox";
import { usePolicyUpdate } from "./PolicyUpdate";
import { wordsOf, type LiveWord } from "@/lib/willab/liveNoteWords";
import TypingDots, { TypingGlyph } from "./TypingDots";

/* -------------------------------------------------------------------------- */
/*  useVoiceNotebook — the founder's voice notebook in the Lounge (Will        */
/*  learning plan, step 1; founder 2026-10-20). Only for whom the backend      */
/*  says it is on (ring 6). Since backend N483 item 7 the note rests: no mic */
/*  and no "#" start one, and Will no longer opens it or asks "Keep a voice  */
/*  notebook?"; the notes already kept stay, and notes left on the phone     */
/*  still go. Its new place is decided with the walk. Backend:               */
/*  services/voice_notebook.py. While the speaker is onboarded (N243), the   */
/*  asks wait.                                                               */
/*                                                                            */
/*  Written as it is said (backend N194): the note grows in the thread while  */
/*  it is said; on send it settles, then a tick under it and "Noted.". A note */
/*  that cannot leave the phone waits in the outbox under a clock and goes    */
/*  when the app is open with a connection, only under the person who said    */
/*  it: another person's notes on the phone are neither shown nor sent. A    */
/*  tap on one's own note opens its words to fix one.                        */
/* -------------------------------------------------------------------------- */

export function useVoiceNotebook({
  signedIn,
  userId,
  threadLoading,
  held,
  drawn,
  openOffer,
  reload,
}: {
  signedIn: boolean;
  /** The person signed in: a change shows and sends their own notes. */
  userId: string | null;
  threadLoading: boolean;
  /** The speaker is being onboarded: no mic, no ask (backend N243). */
  held: boolean;
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

  // The Sunday note's asks (step 2) and the notebook's own open their pair
  // while they are the newest message, once each; not while the speaker is
  // onboarded (N243), and still newest after it, then. "Keep a voice
  // notebook?" no longer opens (N483 item 7).
  const askRef = useRef<string | null>(null);
  useEffect(() => {
    if (threadLoading || held) return;
    const last = drawn[drawn.length - 1];
    const offer = OWN_ASKS.find((type) => type === last?.metadata?.offer);
    if (!last || !offer || askRef.current === last.client_id) return;
    askRef.current = last.client_id;
    openOffer(offer);
  }, [threadLoading, held, drawn, openOffer]);

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
      // Only the signed-in person's own notes, read from the token the
      // upload carries; another person's wait on the phone, untouched.
      const notes = await waitingNotes(await outboxOwner(), currentKeyRef.current());
      setWaiting(notes);
      for (const n of notes) {
        setSending(n.key);
        const outcome = await sendVoiceNote(n.audio, n.durationMs, n.key, n.liveMs);
        if (outcome.kind === "retry") {
          setOffline((now) => new Set(now).add(n.key));
          break; // no connection, a sign-in run out, an update to accept: the rest wait too
        }
        await dropNote(n.key);
        if (outcome.kind === "kept" && outcome.clientId) {
          const id = outcome.clientId;
          setKept((now) => new Set(now).add(id));
        }
        // Kept: the hesitations fade out, then the kept note takes its place
        // with the tick and "Noted." (N199).
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
  // open and online again; held back by a sign-in that ran out (401) or a
  // policy update to accept (403), after the next sign-in or the Accept.
  const awaitingAcceptance = usePolicyUpdate()?.policy != null;
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
  }, [state?.consented, userId, awaitingAcceptance, flush]);

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



  async function answer(choice: "yes" | "not_now"): Promise<void> {
    if (!(await answerNotebook(choice))) return;
    if (choice === "yes") setState((now) => (now ? { ...now, consented: true } : now));
    await reload();
  }

  async function answerSales(noteId: string | null, step: SalesStep): Promise<void> {
    if (noteId && (await answerSalesStep(noteId, step))) await reload();
  }

  return {
    enabled: state?.enabled === true,
    held,
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
    answer: (choice: "yes" | "not_now") => void answer(choice),
    /** A tap on one of the sale's four steps (backend N241 P2). */
    answerSales: (noteId: string | null, step: SalesStep) => void answerSales(noteId, step),
  };
}

export type VoiceNotebook = ReturnType<typeof useVoiceNotebook>;

/** How long the hesitations take to fade once a note is kept. */
const SETTLE_MS = 700;

const OWN_ASKS: readonly OfferType[] = [
  "sunday_note", "life_goals", "life_goals_quarter", "life_goals_change", "sales_step",
  "your_why", "strengths",
];

/** The sale's four steps, in order, as signed (backend N258). */
export const SALES_STEPS: readonly { step: SalesStep; label: string }[] = [
  { step: "opening", label: "The opening" },
  { step: "discovery", label: "Discovery" },
  { step: "offer", label: "The offer" },
  { step: "follow_up", label: "The follow-up" },
];

/** The note whose "Which step did it stall at?" is newest in the thread. */
export function salesAskOf(messages: readonly Pick<LoungeMessage, "metadata">[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const meta = messages[i].metadata;
    if (meta?.offer === "sales_step" && typeof meta.sales_note === "string") return meta.sales_note;
  }
  return null;
}

/** The four steps in place of the record button, in order, as N371's
 *  suggested answers with none filled: no step is likelier than another
 *  (backend N241 P2, N258, N417). */
export function SalesSteps({ onPick }: { onPick: (step: SalesStep) => void }) {
  return (
    <TapRow
      labels={SALES_STEPS.map((s) => s.label)}
      even
      onTap={(label) => {
        const picked = SALES_STEPS.find((s) => s.label === label);
        if (picked) onPick(picked.step);
      }}
      dataAttr={{ "data-testid": "sales-steps" }}
    />
  );
}


/** The note on its way: the one recording bar (backend N314, N304), the
 *  trash, then the walk's strip with Stop inside it; Stop sends. Was the
 *  WhatsApp-style bar (founder 2026-10-20): the time in a bordered pill and
 *  a black send. */
export function VoiceNoteBar({ notebook }: { notebook: VoiceNotebook }) {
  if (!notebook.recording) return null;
  return (
    <div data-testid="voice-note-recording">
      <RecordingBar elapsedMs={notebook.note.elapsedMs} onTrash={notebook.note.cancel} onStop={notebook.note.send} />
    </div>
  );
}

/** The note while it is said, then the notes on the phone not yet kept,
 *  then Will's typing dots while one is on its way (backend N194, N199).
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
 *  send, the bars shimmer while Will writes them down (N199). */
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
        <Send className="h-5 w-5" aria-hidden />
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
