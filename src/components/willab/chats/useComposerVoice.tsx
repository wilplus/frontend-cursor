"use client";

import { useEffect, useRef, useState } from "react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { useVoiceNote } from "../useVoiceNote";
import type { ComposerMic, ComposerRecording, ComposerVoiceDraft } from "./ChatComposer";

const VOICE_COPY = {
  en: { listen: "Play recording", again: "Record again", unavailable: "The microphone is unavailable. Check access and try again." },
  pl: { listen: "Odtwórz nagranie", again: "Nagraj ponownie", unavailable: "Mikrofon jest niedostępny. Sprawdź uprawnienia i spróbuj ponownie." },
};

export function useComposerVoice({
  onSend, maxSeconds, enabled = true, held = false, label, attrs, scope,
}: {
  onSend: (audio: Blob, durationMs: number) => Promise<boolean> | boolean;
  maxSeconds: number;
  enabled?: boolean;
  held?: boolean;
  label?: string;
  attrs?: ComposerMic["attrs"];
  scope?: string;
}) {
  const copy = VOICE_COPY[useUiLocale()];
  const [take, setTake] = useState<{ audio: Blob; durationMs: number; scope?: string } | null>(null);
  const capturedIn = useRef(scope);
  const audio = take?.scope === scope ? take?.audio : undefined;
  const [src, setSrc] = useState("");
  const [error, setError] = useState(false);
  const note = useVoiceNote({
    maxSeconds,
    onDone: async ({ audio, durationMs }) => setTake({ audio, durationMs, scope: capturedIn.current }),
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
    start: () => { capturedIn.current = scope; setError(false); void note.start(); },
    label: audio ? copy.again : label,
    disabled: held || note.phase !== "idle",
    attrs,
  } : undefined;
  const recording: ComposerRecording | undefined = note.phase === "recording" ? {
    elapsedMs: note.elapsedMs, stop: note.send, discard: note.cancel, attrs,
  } : undefined;
  const voiceDraft: ComposerVoiceDraft | undefined = audio && enabled ? {
    preview: <audio src={src} aria-label={copy.listen} controls preload="metadata" className="h-10 w-40 sm:w-52" />,
    discard: () => { setTake(null); setSrc(""); },
    send: async () => {
      if (!take || !await onSend(audio, take.durationMs)) return false;
      setTake(null);
      setSrc("");
      return true;
    },
  } : undefined;

  return {
    mic,
    recording,
    voiceDraft,
    error: error ? copy.unavailable : null,
  };
}
