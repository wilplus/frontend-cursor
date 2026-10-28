"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hearPiece } from "@/services/api/voiceNotebook";
import { liveWords, type LiveWord } from "@/lib/willab/liveNoteWords";
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
/*  The notebook's notes (``notebook: true``) show the wave first, and the    */
/*  words follow (backend N194, N199); the life goals lens records as before. */
/*                                                                            */
/*  The wave: the mic's level, read on the phone every 140 ms, so the note    */
/*  shows at once that it hears. The words: a second recorder on the same    */
/*  mic cuts the note into pieces of a few seconds; the piece being said is   */
/*  sent to be heard every second and a half, and each finished piece once   */
/*  more, whole. They come back 2 to 4 seconds behind the voice and replace   */
/*  the wave they cover; the piece still being heard is lighter. They are a   */
/*  preview: the whole recording is what the backend transcribes and keeps.  */
/*                                                                            */
/*  Only delete throws a note away. What is recorded so far goes to the       */
/*  phone's outbox every few seconds, and leaving the app sends the note, so  */
/*  closing the app at any moment keeps what was said.                        */
/* -------------------------------------------------------------------------- */

export type VoiceNotePhase = "idle" | "recording" | "sending";

/** One bar of the wave: when in the note it was heard, and how loud. */
export interface WaveBar {
  at: number;
  level: number;
}

const BITRATE = 32_000;
/** A live piece: long enough to hold a phrase, short enough to hear fast. */
const PIECE_MS = 6000;
const HEAR_EVERY_MS = 1500;
const OUTBOX_EVERY_MS = 3000;
const BAR_MS = 140;
/** The wave kept in memory: well past what the note can show. */
const MAX_BARS = 400;

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

/** Reads the mic's level, 0 to 1, from the same stream the note records.
 *  null where the phone has no audio graph: the wave then shows quiet bars. */
function levelMeter(stream: MediaStream): { read: () => number; close: () => void } | null {
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    void ctx.resume().catch(() => undefined);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    return {
      read: () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        return Math.min(1, Math.sqrt(sum / data.length) * 4);
      },
      close: () => void ctx.close().catch(() => undefined),
    };
  } catch {
    return null;
  }
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
  /** The voice notebook (N194, N199): the wave and the words, the outbox,
   *  and a note kept when the app is left. Off, the recording is sent or
   *  thrown away as it always was. */
  notebook?: boolean;
}) {
  const [phase, setPhase] = useState<VoiceNotePhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [words, setWords] = useState<LiveWord[]>([]);
  const [wave, setWave] = useState<WaveBar[]>([]);
  const [writtenTo, setWrittenTo] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const keepRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterRef = useRef<ReturnType<typeof levelMeter>>(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const keyRef = useRef("");
  const savedAtRef = useRef(0);

  // The words: finished pieces by their order, and the piece being heard.
  const pieceRef = useRef<Piece | null>(null);
  const finishedRef = useRef<string[]>([]);
  const currentRef = useRef("");
  const hearingRef = useRef(false);
  const liveRef = useRef(false);
  const heardAtRef = useRef(0);
  // The wave, and how far into the note the words reach.
  const waveRef = useRef<WaveBar[]>([]);
  const writtenToRef = useRef(0);

  const showWords = () => setWords(liveWords(finishedRef.current.filter(Boolean), currentRef.current));
  const spoken = () => [...finishedRef.current.filter(Boolean), currentRef.current].join(" ").trim();
  /** The wave the words have not reached yet. */
  const tail = () => waveRef.current.filter((b) => b.at > writtenToRef.current).map((b) => b.level);

  const stopTicking = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (waveTickRef.current) clearInterval(waveTickRef.current);
    tickRef.current = null;
    waveTickRef.current = null;
    meterRef.current?.close();
    meterRef.current = null;
  };

  const saveToOutbox = useCallback((open: boolean) => {
    if (!notebook || !keyRef.current || !chunksRef.current.length) return;
    savedAtRef.current = Date.now();
    void keepNote({
      key: keyRef.current,
      audio: new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || pickType() || "audio/webm" }),
      durationMs: Date.now() - startedRef.current,
      words: spoken(),
      tail: tail(),
      open,
      at: startedRef.current,
    });
  }, [notebook]);

  const hear = useCallback(async (piece: Piece, finished: boolean) => {
    if (!piece.chunks.length) return;
    // How far into the note this clip reaches: the words it brings cover
    // the wave up to here.
    const reach = finished ? piece.startedAt - startedRef.current + PIECE_MS : Date.now() - startedRef.current;
    const audio = new Blob(piece.chunks, { type: piece.recorder.mimeType || "audio/webm" });
    const text = await hearPiece(audio);
    if (!liveRef.current || text === null) return;
    if (finished) {
      finishedRef.current[piece.index] = text.trim();
    } else if (pieceRef.current === piece) {
      currentRef.current = text.trim();
    } else {
      return;
    }
    if (reach > writtenToRef.current) {
      writtenToRef.current = reach;
      setWrittenTo(reach);
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
      pieceRef.current = null; // no words on this phone; the wave and the note go on
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
    waveRef.current = [];
    writtenToRef.current = 0;
    keyRef.current = noteKey();
    setWords([]);
    setWave([]);
    setWrittenTo(0);
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
      setWords([]);
      setWave([]);
      if (!keepRef.current || !audio.size) {
        if (notebook) void dropNote(key);
        setPhase("idle");
        return;
      }
      const note: OutboxNote = {
        key,
        audio,
        durationMs: duration,
        words: spoken(),
        tail: tail(),
        open: false,
        at: startedRef.current,
      };
      if (!notebook) {
        setPhase("sending");
        void onDoneRef.current(note).finally(() => setPhase("idle"));
        return;
      }
      // Into the outbox first: from here the note survives the app closing.
      // The thread shows it at once, with the wave not yet written (N199).
      setPhase("idle");
      void keepNote(note).then(() => {
        if (mountedRef.current) void onDoneRef.current(note);
      });
    };
    recorderRef.current = recorder;
    startedRef.current = Date.now();
    savedAtRef.current = Date.now();
    setElapsedMs(0);
    recorder.start(1000);
    liveRef.current = notebook;
    if (notebook) {
      nextPiece(stream, mimeType, 0);
      meterRef.current = levelMeter(stream);
      waveTickRef.current = setInterval(() => {
        const level = meterRef.current?.read() ?? 0.15;
        waveRef.current = [...waveRef.current, { at: Date.now() - startedRef.current, level }].slice(-MAX_BARS);
        setWave(waveRef.current);
      }, BAR_MS);
    }
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
  // what was said (backend N194).
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
    /** The note's words while it is said: finished pieces, then the piece
     *  still being heard (lighter). */
    words,
    /** The wave the words have not reached yet, newest last. */
    wave: wave.filter((b) => b.at > writtenTo),
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
