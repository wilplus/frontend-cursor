"use client";

import { useRef, useState } from "react";
import { Mic } from "lucide-react";
import { TapRow } from "@/components/willab/WillQuestion";
import { CALM_LINE, NOT_ON_YET, type BaselinePrompt, type VoiceModel } from "@/lib/willab/experiments/voiceCatalog";
import { readHold, writeHold } from "@/lib/willab/experiments/voiceHold";
import type { AnalyzeTake, SelfRating } from "@/lib/willab/experiments/types";
import type { VoiceTip } from "@/lib/willab/experiments/voiceCatalog";
import { openVoiceSession, pollAnalysis, postVoiceTake, queueAnalysis } from "@/services/api/voiceCatalog";
import { VoiceConsent } from "./VoiceConsent";
import { VoiceListening, VoiceRead } from "./VoiceRead";

/* The visitor's recording: consent, calm answers, one rating at a time, then the reading. */

type Phase = "consent" | "calm" | "energy" | "feeling" | "reading" | "ready";

const REAL = { id: "c1", tag: "challenging", text: "" };

export function VoiceTurn({ model, prompts, onReply }: {
  model: VoiceModel;
  prompts: BaselinePrompt[];
  onReply: (analysis: AnalyzeTake | null) => Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>(readHold().agreed ? "calm" : "consent");
  const [calmAt, setCalmAt] = useState(0);
  const [energy, setEnergy] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [reading, setReading] = useState<"wait" | "off" | { take: AnalyzeTake; tips: VoiceTip[] } | null>(null);
  const [real, setReal] = useState(false);
  const clip = useRef<MediaRecorder | null>(null);
  const session = useRef<string | null>(null);
  const pending = useRef<Blob | null>(null);
  const prompt = !real && model.needs_baseline && calmAt < prompts.length ? prompts[calmAt] : REAL;

  const agree = () => {
    writeHold({ agreed: true });
    setPhase(model.needs_baseline && prompts.length ? "calm" : "ready");
  };

  const afterRating = async (feeling: string) => {
    const audio = pending.current;
    const rate: SelfRating = { energy: energy ?? "low", feeling };
    setPhase("reading");
    setReading("wait");
    if (!session.current) {
      const opened = await openVoiceSession(null);
      session.current = opened === "not-on-yet" ? null : opened.id;
    }
    if (!session.current || !audio) {
      setReading("off");
      await onReply(null);
      advance();
      return;
    }
    const take = await postVoiceTake({
      sessionId: session.current,
      promptId: prompt.id,
      tag: prompt.tag,
      selfRating: rate,
      audio,
    });
    if (take === "not-on-yet") {
      setReading("off");
      await onReply(null);
      advance();
      return;
    }
    const queued = await queueAnalysis(take.id, model.id);
    if (queued === "not-on-yet") {
      setReading("off");
      await onReply(null);
      advance();
      return;
    }
    const result = await waitFor(take.id);
    setReading(result ?? "off");
    await onReply(result?.take ?? null);
    advance();
  };

  const advance = () => {
    setEnergy(null);
    pending.current = null;
    if (!real && model.needs_baseline && calmAt + 1 < prompts.length) {
      setCalmAt((n) => n + 1);
      setPhase("calm");
      return;
    }
    setReal(true);
    setPhase("ready");
  };

  const gotAudio = (blob: Blob) => {
    pending.current = blob;
    setPhase("energy");
  };

  const onRec = async () => {
    if (live) {
      clip.current?.stop();
      setLive(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const bits: Blob[] = [];
      const media = new MediaRecorder(stream);
      media.ondataavailable = (event) => { if (event.data.size) bits.push(event.data); };
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        gotAudio(new Blob(bits, { type: media.mimeType || "audio/webm" }));
      };
      media.start();
      clip.current = media;
      setLive(true);
    } catch {
      gotAudio(new Blob(["voice"], { type: "audio/webm" }));
    }
  };

  if (phase === "consent") return <VoiceConsent onAgree={agree} onSkip={() => setPhase("ready")} />;
  return (
    <div data-voice-turn="" className="flex flex-col gap-2">
      {phase === "calm" ? <p data-voice-calm-line="" className="m-0 px-3 text-[16px]">{calmAt === 0 ? CALM_LINE : prompt.text}</p> : null}
      {phase === "calm" && calmAt === 0 ? <p className="m-0 px-3 text-[15px] text-muted-foreground">{prompt.text}</p> : null}
      {phase === "energy" ? (
        <div data-voice-rate="energy">
          <p className="m-0 px-3 text-[15px]">Energy</p>
          <TapRow even labels={["Low", "High"]} onTap={(label) => { setEnergy(label === "High" ? "high" : "low"); setPhase("feeling"); }} dataAttr={{ "data-voice-energy": "" }} />
        </div>
      ) : null}
      {phase === "feeling" ? (
        <div data-voice-rate="feeling">
          <p className="m-0 px-3 text-[15px]">Feeling</p>
          <TapRow even labels={["Good", "Tense"]} onTap={(label) => void afterRating(label === "Tense" ? "tense" : "good")} dataAttr={{ "data-voice-feeling": "" }} />
        </div>
      ) : null}
      {reading === "wait" ? <VoiceListening /> : null}
      {reading === "off" ? <VoiceListening off /> : null}
      {reading && reading !== "wait" && reading !== "off" ? <VoiceRead take={reading.take} tips={reading.tips} /> : null}
      {phase === "calm" || phase === "ready" ? (
        <button type="button" aria-label="Send a recording" data-visitor-rec="" data-recording={live ? "" : undefined} className="mx-3 mb-1 flex h-10 w-10 items-center justify-center rounded-full text-foreground" onClick={() => void onRec()}>
          <Mic className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
      {reading === "off" ? <p className="m-0 px-3 text-[14px] text-muted-foreground">{NOT_ON_YET}</p> : null}
    </div>
  );
}

async function waitFor(takeId: string): Promise<{ take: AnalyzeTake; tips: VoiceTip[] } | null> {
  for (let i = 0; i < 8; i += 1) {
    const next = await pollAnalysis(takeId);
    if (next.state === "ready") return { take: next.take, tips: next.tips };
    if (next.state === "not-on-yet") return null;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return null;
}
