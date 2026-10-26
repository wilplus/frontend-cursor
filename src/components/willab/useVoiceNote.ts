"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hearPiece } from "@/services/api/voiceNotebook";
import { liveWords, settledWords, type LiveWord } from "@/lib/willab/liveNoteWords";
import { dropNote, keepNote, noteKey, type OutboxNote } from "@/lib/willab/voiceNoteOutbox";

/* -------------------------------------------------------------------------- */
/*  useVoiceNote — the Lounge mic for the founder's voice notebook (Will       */
/*  learning plan, step 1; founder 2026-10-20: "exactly like WhatsApp").       */
/*                                                                            */
/*  Tap the mic: it records. Trash throws it away, the arrow sends it. It      */
/*  stops and sends by itself at the limit (five minutes). Low bitrate, so a   */
/*  full note stays far under the upload limit. Not the official recording:   */
/*  nothing here touches a Take.                                              */
/*                                                                            */
/*  The notebook's notes (``notebook: true``) are written as they are said   */
/*  (backend N194); the life goals lens records as before.                    */
/*                                                                            */
/*  Written as it is said (backend N194). A second recorder on the same mic   */
/*  cuts the note into pieces of a few seconds; the piece being said is sent  */
/*  to be heard every second and a half, and each finished piece once more,   */
/*  so the words appear in the note while it is said. Those words are a       */
/*  preview: the whole recording is what the backend transcribes and keeps.   */
/*                                                                            */
/*  Only delete throws a note away. What is recorded so far goes to the       */
/*  phone's outbox every few seconds, and leaving the app sends the note, so  */
/*  closing the app at any moment keeps what was said.                        */
/* -------------------------------------------------------------------------- */

export type VoiceNotePhase = "idle" | "recording" | "settling" | "sending";

const BITRATE = 32_000;
/** A live piece: long enough to hold a phrase, short enough to hear fast. */
const PIECE_MS = 6000;
const HEAR_EVERY_MS = 1500;
/** How long the hesitations take to fade before the note settles. */
const SETTLE_MS = 700;
const OUTBOX_EVERY_MS = 3000;

function pickType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
}

interface Piece {
  recorder: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
  index: number;
}

export function useVoiceNote({
  maxSeconds,
  onDone,
  notebook = false,
}: {
  maxSeconds: number;
  /** The finished recording; resolves when it is sent (or failed). For the
   *  notebook it is already in the outbox. */
  onDone: (note: OutboxNote) => Promise<void>;
  /** The voice notebook (N194): live words, the outbox, and a note kept
   *  when the app is left. Off, the recording is sent or thrown away as it
   *  always was. */
  notebook?: boolean;
}) {
  const [phase, setPhase] = useState<VoiceNotePhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [words, setWords] = useState<LiveWord[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const keepRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const keyRef = useRef("");
  const savedAtRef = useRef(0);

  // The live words: finished pieces by their order, and the piece being said.
  const pieceRef = useRef<Piece | null>(null);
  const finishedRef = useRef<string[]>([]);
  const currentRef = useRef("");
  const hearingRef = useRef(false);
  const liveRef = useRef(false);
  const heardAtRef = useRef(0);

  const showWords = () => setWords(liveWords(finishedRef.current.filter(Boolean), currentRef.current));

  const stopTicking = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const saveToOutbox = useCallback((open: boolean) => {
    if (!notebook || !keyRef.current || !chunksRef.current.length) return;
    savedAtRef.current = Date.now();
    void keepNote({
      key: keyRef.current,
      audio: new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || pickType() || "audio/webm" }),
      durationMs: Date.now() - startedRef.current,
      words: settledWords(liveWords(finishedRef.current.filter(Boolean), currentRef.current)),
      open,
      at: startedRef.current,
    });
  }, [notebook]);

  const hear = useCallback(async (piece: Piece, finished: boolean) => {
    if (!piece.chunks.length) return;
    const audio = new Blob(piece.chunks, { type: piece.recorder.mimeType || "audio/webm" });
    const text = await hearPiece(audio);
    if (!liveRef.current || text === null) return;
    if (finished) {
      finishedRef.current[piece.index] = text.trim();
    } else if (pieceRef.current === piece) {
      currentRef.current = text.trim();
    }
    showWords();
  }, []);

  /** Start the next live piece on the same stream. */
  const nextPiece = useCallback((stream: MediaStream, mimeType: string | undefined, index: number) => {
    try {
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24_000 });
      const piece: Piece = { recorder, chunks: [], startedAt: Date.now(), index };
      recorder.ondataavailable = (e) => {
        if (e.data.size) piece.chunks.push(e.data);
      };
      recorder.start(500);
      pieceRef.current = piece;
    } catch {
      pieceRef.current = null; // no live words on this phone; the note records as before
    }
  }, []);

  const stopLive = useCallback(() => {
    liveRef.current = false;
    const piece = pieceRef.current;
    pieceRef.current = null;
    try {
      if (piece && piece.recorder.state !== "inactive") piece.recorder.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const stop = useCallback((keep: boolean) => {
    keepRef.current = keep;
    stopLive();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, [stopLive]);

  const start = useCallback(async () => {
    if (phase !== "idle" || startingRef.current || typeof navigator === "undefined" || !navigator.mediaDevices) return;
    startingRef.current = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      startingRef.current = false;
      return; // no mic permission: nothing changes on screen
    }
    const release = () => stream.getTracks().forEach((t) => t.stop());
    startingRef.current = false;
    if (!mountedRef.current) {
      release(); // the Lounge closed while the browser asked for the mic
      return;
    }
    const mimeType = pickType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: BITRATE,
      });
    } catch {
      release(); // a browser that cannot record this format: the mic goes off
      return;
    }
    chunksRef.current = [];
    finishedRef.current = [];
    currentRef.current = "";
    keyRef.current = noteKey();
    setWords([]);
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
      if (Date.now() - savedAtRef.current >= OUTBOX_EVERY_MS) saveToOutbox(true);
    };
    recorder.onstop = () => {
      stopTicking();
      stopLive();
      release();
      recorderRef.current = null;
      const key = keyRef.current;
      keyRef.current = "";
      const duration = Date.now() - startedRef.current;
      const audio = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
      if (!keepRef.current || !audio.size) {
        if (notebook) void dropNote(key);
        setWords([]);
        setPhase("idle");
        return;
      }
      const note: OutboxNote = {
        key,
        audio,
        durationMs: duration,
        words: settledWords(liveWords(finishedRef.current.filter(Boolean), currentRef.current)),
        open: false,
        at: startedRef.current,
      };
      if (!notebook) {
        setPhase("sending");
        void onDoneRef.current(note).finally(() => setPhase("idle"));
        return;
      }
      // Into the outbox first: from here the note survives the app closing.
      void keepNote(note).then(() => {
        if (!mountedRef.current) return;
        setPhase("settling");
        setTimeout(() => {
          setWords([]);
          setPhase("idle");
          void onDoneRef.current(note);
        }, SETTLE_MS);
      });
    };
    recorderRef.current = recorder;
    startedRef.current = Date.now();
    savedAtRef.current = Date.now();
    setElapsedMs(0);
    recorder.start(1000);
    liveRef.current = notebook;
    if (notebook) nextPiece(stream, mimeType, 0);
    setPhase("recording");
    tickRef.current = setInterval(() => {
      const ms = Date.now() - startedRef.current;
      setElapsedMs(ms);
      if (ms >= maxSeconds * 1000) {
        stop(true);
        return;
      }
      const piece = pieceRef.current;
      if (!piece || !liveRef.current) return;
      if (Date.now() - piece.startedAt >= PIECE_MS) {
        // The piece is done: start the next, then hear this one whole.
        // What was heard of it stays on screen until its whole is heard.
        finishedRef.current[piece.index] = currentRef.current;
        currentRef.current = "";
        nextPiece(stream, mimeType, piece.index + 1);
        piece.recorder.onstop = () => void hear(piece, true);
        try {
          piece.recorder.stop();
        } catch {
          /* already stopped */
        }
        return;
      }
      const now = Date.now();
      if (!hearingRef.current && now - piece.startedAt >= HEAR_EVERY_MS && now - heardAtRef.current >= HEAR_EVERY_MS) {
        heardAtRef.current = now;
        hearingRef.current = true;
        void hear(piece, false).finally(() => {
          hearingRef.current = false;
        });
      }
    }, 250);
  }, [phase, maxSeconds, notebook, stop, stopLive, nextPiece, hear, saveToOutbox]);

  // Leaving the app while a note is said sends it: closing the app keeps
  // what was said (backend N194). Unmounting inside the app (the Lounge
  // closing) keeps it too.
  useEffect(() => {
    if (!notebook) return;
    const leave = () => {
      if (document.visibilityState === "hidden" && recorderRef.current) {
        saveToOutbox(false);
        stop(true);
      }
    };
    const hide = () => {
      if (recorderRef.current) {
        saveToOutbox(false);
        stop(true);
      }
    };
    document.addEventListener("visibilitychange", leave);
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("visibilitychange", leave);
      window.removeEventListener("pagehide", hide);
    };
  }, [notebook, stop, saveToOutbox]);

  // Leaving the Lounge mid-note: the notebook keeps it (it goes from the
  // outbox next time); elsewhere it is thrown away and the mic freed.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (notebook && recorderRef.current) saveToOutbox(false);
      stop(notebook);
    };
  }, [notebook, stop, saveToOutbox]);

  return {
    phase,
    elapsedMs,
    /** The note's words while it is said and while it settles. */
    words,
    /** The note being said right now, so the outbox leaves it alone. */
    currentKey: () => keyRef.current,
    start,
    send: () => stop(true),
    cancel: () => stop(false),
  };
}

/** m:ss for the running note. */
export function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
