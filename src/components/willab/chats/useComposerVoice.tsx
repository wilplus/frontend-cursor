"use client";

import { useEffect, useState } from "react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { useVoiceNote } from "../useVoiceNote";
import type { ComposerMic, ComposerRecording, ComposerVoiceDraft } from "./ChatComposer";

const VOICE_COPY = {
  en: { listen: "Play recording", again: "Record again", unavailable: "The microphone is unavailable. Check access and try again." },
  pl: { listen: "Odtwórz nagranie", again: "Nagraj ponownie", unavailable: "Mikrofon jest niedostępny. Sprawdź uprawnienia i spróbuj ponownie." },
};

export function useComposerVoice({
  onSend, maxSeconds, enabled = true, held = false, label, attrs,
}: {
  onSend: (audio: Blob) => Promise<boolean> | boolean;
  maxSeconds: number;
  enabled?: boolean;
  held?: boolean;
  label?: string;
  attrs?: ComposerMic["attrs"];
}) {
  const copy = VOICE_COPY[useUiLocale()];
  const [audio, setAudio] = useState<Blob | null>(null);
  const [src, setSrc] = useState("");
  const [error, setError] = useState(false);
  const note = useVoiceNote({
    maxSeconds,
    onDone: async ({ audio }) => setAudio(audio),
    onUnavailable: () => setError(true),
  });

  useEffect(() => {
    if (!audio) return;
    const url = URL.createObjectURL(audio);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);

  const mic: ComposerMic | undefined = enabled ? {
    start: () => { setError(false); void note.start(); },
    label: audio ? copy.again : label,
    disabled: held || note.phase !== "idle",
    attrs,
  } : undefined;
  const recording: ComposerRecording | undefined = note.phase === "recording" ? {
    elapsedMs: note.elapsedMs, stop: note.send, discard: note.cancel, attrs,
  } : undefined;
  const voiceDraft: ComposerVoiceDraft | undefined = audio && enabled ? {
    preview: <audio src={src} aria-label={copy.listen} controls preload="metadata" className="h-10 w-40 sm:w-52" />,
    discard: () => { setAudio(null); setSrc(""); },
    send: async () => {
      if (!await onSend(audio)) return false;
      setAudio(null);
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
