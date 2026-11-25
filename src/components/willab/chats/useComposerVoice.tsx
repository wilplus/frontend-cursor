"use client";

import { useEffect, useRef, useState } from "react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { useVoiceNote } from "../useVoiceNote";
import type { ComposerMic, ComposerRecording, ComposerVoiceDraft } from "./ChatComposer";

const VOICE_COPY = {
  en: { listen: "Play recording", again: "Record again", unavailable: "The microphone is unavailable. Check access and try again.", retry: "Couldn’t send the recording. Try again." },
  pl: { listen: "Odtwórz nagranie", again: "Nagraj ponownie", unavailable: "Mikrofon jest niedostępny. Sprawdź uprawnienia i spróbuj ponownie.", retry: "Nie udało się wysłać nagrania. Spróbuj ponownie." },
};

export function useComposerVoice({
  onSend, maxSeconds, enabled = true, held = false, label, attrs, scope, prepareOnStop = false, ready, onStream,
  practiceReplyId,
}: {
  onSend: (audio: Blob, durationMs: number, recordingId?: string, practiceReplyId?: string) => Promise<boolean> | boolean;
  maxSeconds: number;
  enabled?: boolean;
  held?: boolean;
  label?: string;
  attrs?: ComposerMic["attrs"];
  scope?: string;
  prepareOnStop?: boolean;
  ready?: boolean;
  onStream?: (stream: MediaStream) => (() => void) | undefined;
  practiceReplyId?: string;
}) {
  const copy = VOICE_COPY[useUiLocale()];
  const [take, setTake] = useState<{
    audio: Blob; durationMs: number; key: string; scope?: string; practiceReplyId?: string;
  } | null>(null);
  const capturedIn = useRef(scope);
  const capturedReply = useRef<string | undefined>(undefined);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const pending = take?.scope === scope ? take : null;
  const audio = !prepareOnStop ? pending?.audio : undefined;
  const [src, setSrc] = useState("");
  const [error, setError] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const note = useVoiceNote({
    maxSeconds,
    onStream,
    onDone: async ({ audio, durationMs, key }) => {
      const recording = { audio, durationMs, key, scope: capturedIn.current, practiceReplyId: capturedReply.current };
      if (recording.scope !== activeScope.current) return;
      if (prepareOnStop) {
        try {
          if (await onSend(audio, durationMs, key, recording.practiceReplyId)) return;
        } catch { /* Keep a failed upload available to retry. */ }
        if (recording.scope !== activeScope.current) return;
        setFailed(true);
      }
      setTake(recording);
    },
    onUnavailable: () => setError(true),
  });

  useEffect(() => {
    if (!audio) return;
    const url = URL.createObjectURL(audio);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);
  useEffect(() => {
    if (capturedIn.current !== scope && note.phase === "recording") note.cancel();
  }, [note, scope]);

  const mic: ComposerMic | undefined = enabled ? {
    start: () => {
      capturedIn.current = scope;
      capturedReply.current = ready ? practiceReplyId : undefined;
      setError(false);
      setFailed(false);
      if (prepareOnStop) setTake(null);
      void note.start();
    },
    label: audio ? copy.again : label,
    disabled: held || note.phase !== "idle",
    ready,
    attrs,
  } : undefined;
  const recording: ComposerRecording | undefined = note.phase === "recording" ? {
    elapsedMs: note.elapsedMs, stop: note.send, discard: note.cancel, listening: prepareOnStop, attrs,
  } : undefined;
  const voiceDraft: ComposerVoiceDraft | undefined = audio && enabled ? {
    preview: <audio src={src} aria-label={copy.listen} controls preload="metadata" className="h-10 w-40 sm:w-52" />,
    discard: () => { setTake(null); setSrc(""); setFailed(false); },
    send: async () => {
      if (!take || !await onSend(audio, take.durationMs, take.key, take.practiceReplyId)) return false;
      setTake(null);
      setSrc("");
      setFailed(false);
      return true;
    },
  } : undefined;

  return {
    mic,
    recording,
    voiceDraft,
    sending: prepareOnStop && (note.phase === "sending" || retrying),
    retry: prepareOnStop && failed && pending ? async () => {
      if (retrying) return;
      setRetrying(true);
      try {
        if (await onSend(pending.audio, pending.durationMs, pending.key, pending.practiceReplyId)) {
          setTake(null);
          setFailed(false);
        }
      } catch { /* The recording still belongs to this draft. */ }
      finally { setRetrying(false); }
    } : undefined,
    error: error ? copy.unavailable : failed && pending ? copy.retry : null,
  };
}
