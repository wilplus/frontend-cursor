"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, Trash2 } from "lucide-react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import SymmetricPair from "./SymmetricPair";
import {
  answerNotebook,
  askNotebook,
  getNotebookState,
  sendVoiceNote,
  type NotebookState,
} from "@/services/api/voiceNotebook";
import type { OfferType } from "./loungeOffers";
import { clock, useVoiceNote } from "./useVoiceNote";

/* -------------------------------------------------------------------------- */
/*  useVoiceNotebook — the founder's voice notebook in the Lounge (Will        */
/*  learning plan, step 1; founder 2026-10-20). Only for whom the backend      */
/*  says it is on (ring 6). The mic sits right of the message box while it is */
/*  empty; before the first note "Keep a voice notebook?" opens Yes | Not now */
/*  while it is the newest message. Backend: services/voice_notebook.py.      */
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

  const note = useVoiceNote({
    maxSeconds: state?.max_seconds ?? 300,
    onDone: async (audio, durationMs) => {
      if (await sendVoiceNote(audio, durationMs)) await reload();
    },
  });

  async function tapMic(): Promise<void> {
    if (state?.consented) {
      void note.start();
      return;
    }
    if (await askNotebook()) await reload();
    openOffer("voice_notebook");
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
    /** The message box's display: it gives way to the recording bar. */
    composerDisplay: note.phase === "recording" ? "hidden" : "flex",
    tapMic: () => void tapMic(),
    answer: (choice: "yes" | "not_now") => void answer(choice),
  };
}

export type VoiceNotebook = ReturnType<typeof useVoiceNotebook>;

const OWN_ASKS: readonly OfferType[] = ["voice_notebook", "sunday_note", "life_goals", "life_goals_quarter", "life_goals_change"];

/** The mic, right of the message box: only where the notebook is on and the
 *  box is empty; held while the last note is on its way. */
export function VoiceNoteMic({ notebook, draft }: { notebook: VoiceNotebook; draft: string }) {
  if (!notebook.enabled || draft.trim()) return null;
  const sending = notebook.note.phase === "sending";
  return (
    <button
      type="button"
      onClick={notebook.tapMic}
      disabled={sending}
      aria-label="Voice note"
      data-testid="voice-note-mic"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:text-muted-foreground/50"
    >
      <Mic className={`h-5 w-5 ${sending ? "animate-pulse" : ""}`} aria-hidden />
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
