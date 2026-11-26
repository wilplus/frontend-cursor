"use client";

import { useEffect, useRef, useState } from "react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { BASELINE_PILOT_ENTRY, baselinePilot, FELT_ENERGY, FELT_VALENCE,
  type BaselineAccessError, type BaselineReport, type BaselineStep, type FeltEnergy } from "@/services/api/baselinePilot";
import WalkPlayer from "../../../walk/WalkPlayer";
import ChatComposer from "../../ChatComposer";
import { ChatScroll } from "../../ChatWorkspace";
import { ConversationBubble } from "../../TakeConversation";
import { useComposerVoice } from "../../useComposerVoice";
import { choiceBubble } from "../bits";
import { useBaselinePilot, type BaselineApi } from "./useBaselinePilot";

const COPY = {
  en: {
    title: "Speaking Coach pilot", preview: "Local preview", begin: "Agree and start", loading: "Loading…",
    energy: "How much energy did you actually feel while speaking?", saved: "Recording saved.",
    valence: "How did it feel while you were speaking?",
    recording: "Your recording", done: "Saved. That’s all for now.", retry: "Try again",
    error: "Couldn’t save this step. Your completed answers are kept. Please try again.",
    loadError: "Couldn’t open this baseline. Please try again.",
    unavailable: "The pilot is not ready yet.", saving: "Saving…",
    denied: "This pilot is unavailable for your account.", signIn: "Sign in to open the pilot.",
    energies: ["Low", "Low to medium", "Medium", "Medium to high", "High", "Not sure"],
    feelings: ["Pleasant", "Unpleasant", "Neutral", "Mixed", "Not sure"],
  },
  pl: {
    title: "Pilotaż trenera wystąpień", preview: "Podgląd lokalny", begin: "Zgadzam się, zaczynamy", loading: "Wczytywanie…",
    energy: "Ile energii faktycznie czułeś podczas mówienia?", saved: "Nagranie zapisane.",
    valence: "Jak się czułeś podczas mówienia?",
    recording: "Twoje nagranie", done: "Zapisane. Na razie to wszystko.", retry: "Spróbuj ponownie",
    error: "Nie udało się zapisać tego kroku. Ukończone odpowiedzi są zachowane. Spróbuj ponownie.",
    loadError: "Nie udało się otworzyć tego podglądu. Spróbuj ponownie.",
    unavailable: "Pilotaż nie jest jeszcze gotowy.", saving: "Zapisywanie…",
    denied: "Pilotaż jest niedostępny dla Twojego konta.", signIn: "Zaloguj się, aby otworzyć pilotaż.",
    energies: ["Niska", "Niska do średniej", "Średnia", "Średnia do wysokiej", "Wysoka", "Nie wiem"],
    feelings: ["Przyjemnie", "Nieprzyjemnie", "Neutralnie", "Mieszane odczucia", "Nie wiem"],
  },
};

export function PilotAccessNotice({ kind }: { kind: BaselineAccessError["kind"] }) {
  const copy = COPY[useUiLocale()];
  return <main className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
    {kind === "signed-out" ?
      <a className="min-h-11 underline" href={`/login?redirectTo=${BASELINE_PILOT_ENTRY}`}>{copy.signIn}</a> :
      <p role="status">{copy.denied}</p>}
  </main>;
}

function RecordedAnswer({ audio, savedSrc, label }: { audio?: Blob; savedSrc?: string; label: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!audio) return;
    const url = URL.createObjectURL(audio);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);
  return <ConversationBubble speaker>{src || savedSrc
    ? <WalkPlayer src={src || savedSrc!} seed="baseline-answer" look="bare" label={label} />
    : <p>{label}</p>}</ConversationBubble>;
}

function StepChoices({ feeling, busy, copy, onReport }: {
  feeling: boolean; busy: boolean; copy: typeof COPY.en; onReport: (value: BaselineReport) => Promise<void>;
}) {
  const question = feeling ? copy.valence : copy.energy;
  const options = feeling ? FELT_VALENCE.map((value, index) => ({
    label: copy.feelings[index], value, attrs: { "data-felt-valence": value }, report: { felt_valence: value },
  })) : FELT_ENERGY.map((value, index) => ({
    label: copy.energies[index], value, attrs: { "data-felt-energy": value }, report: { felt_energy: value },
  }));
  return <>
    <ConversationBubble>{question}</ConversationBubble>
    <div role="group" aria-label={question} className="ml-auto flex max-w-[90%] flex-wrap justify-end gap-2">
      {options.map(({ label, value, attrs, report }) => <button key={value} type="button" {...attrs}
        disabled={busy} onClick={() => void onReport(report)} className={choiceBubble(false)}>
        {label}
      </button>)}
    </div>
  </>;
}

function CurrentStep({ step, audioPath, audio, energy, busy, copy, onReport }: {
  step: BaselineStep; audioPath: string; audio?: Blob; energy?: FeltEnergy; busy: boolean;
  copy: typeof COPY.en; onReport: (value: BaselineReport) => Promise<void>;
}) {
  return <>
    <ConversationBubble>{step.prompt}</ConversationBubble>
    {step.state !== "record" ? <>
      <RecordedAnswer audio={audio} savedSrc={audioPath} label={copy.saved} />
      {energy ? <ReportedChoice question={copy.energy} answer={copy.energies[FELT_ENERGY.indexOf(energy)]} /> : null}
      <StepChoices feeling={step.state === "valence"} busy={busy} copy={copy} onReport={onReport} />
    </> : null}
  </>;
}

function ReportedChoice({ question, answer }: { question: string; answer: string }) {
  return <><ConversationBubble>{question}</ConversationBubble><ConversationBubble speaker>{answer}</ConversationBubble></>;
}

function BaselineNotice({ flow, voice, copy }: {
  flow: ReturnType<typeof useBaselinePilot>; voice: ReturnType<typeof useComposerVoice>; copy: typeof COPY.en;
}) {
  if (!flow.failed && !voice.error) return null;
  const retry = voice.retry ?? (voice.error && voice.mic ? voice.mic.start : flow.retry);
  return <div role="alert" className="text-sm">
    <p>{voice.error || (flow.status ? copy.error : copy.loadError)}</p>
    <button type="button" disabled={flow.busy} onClick={() => void retry()} className="min-h-11 underline">{copy.retry}</button>
  </div>;
}

export default function BaselinePilot({ api = baselinePilot, preview = true }: { api?: BaselineApi; preview?: boolean }) {
  const locale = useUiLocale();
  const copy = COPY[locale];
  const flow = useBaselinePilot(api, locale);
  const scroll = useRef<HTMLDivElement>(null);
  const step = flow.step;
  const voice = useComposerVoice({
    enabled: step?.state === "record" && !flow.accessError,
    held: flow.busy, ready: true, prepareOnStop: true, maxSeconds: 45,
    scope: [flow.run?.id, step?.id, step?.state].join(":"),
    onSend: flow.upload,
  });
  useEffect(() => {
    const el = scroll.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [step?.id, step?.state, flow.complete, flow.answers.length]);
  const failed = flow.failed || voice.error;
  if (flow.accessError) return <PilotAccessNotice kind={flow.accessError} />;

  return <main data-baseline-pilot data-entry-allowed={flow.complete ? "true" : "false"}
    className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
      <h1 className="text-lg font-semibold">{copy.title}</h1>
      {preview ? <span className="text-xs text-muted-foreground">{copy.preview}</span> : null}
    </header>
    <ChatScroll ref={scroll} className="px-4 py-5">
      <div role="log" aria-label={copy.title} className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end gap-3">
        {!flow.run && flow.disclosure ? <>
          <ConversationBubble>
            <p>{flow.disclosure.recording}</p><p>{flow.disclosure.purpose}</p><p>{flow.disclosure.use}</p>
          </ConversationBubble>
          <button type="button" onClick={() => void flow.begin()} disabled={flow.busy}
            className="min-h-11 self-end rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50">
            {flow.busy ? copy.saving : copy.begin}
          </button>
        </> : null}
        {flow.answers.map(answer => <div key={answer.step.id} className="flex flex-col gap-3">
          <ConversationBubble>{answer.step.prompt}</ConversationBubble>
          <RecordedAnswer audio={answer.audio}
            savedSrc={flow.run ? api.audioPath(flow.run.id, answer.step.id) : undefined} label={copy.saved} />
          {answer.energy ? <ReportedChoice question={copy.energy} answer={copy.energies[FELT_ENERGY.indexOf(answer.energy)]} /> : null}
          {answer.valence ? <ReportedChoice question={copy.valence} answer={copy.feelings[FELT_VALENCE.indexOf(answer.valence)]} /> : null}
        </div>)}
        {step && flow.run ? <CurrentStep step={step} audioPath={api.audioPath(flow.run.id, step.id)} busy={flow.busy} copy={copy}
          audio={flow.captured?.step === step.id ? flow.captured.audio : undefined} energy={flow.energy} onReport={flow.report} /> : null}
        {flow.complete ? <ConversationBubble><p role="status">{copy.done}</p></ConversationBubble> : null}
        {!flow.status && !failed ? <p role="status" className="text-muted-foreground">{copy.loading}</p> : null}
        {flow.status && !flow.run && !flow.status.disclosure ? <ConversationBubble>{copy.unavailable}</ConversationBubble> : null}
        {voice.sending || (flow.busy && step?.state !== "record" && step) ?
          <p role="status" className="text-sm text-muted-foreground">{copy.saving}</p> : null}
        <BaselineNotice flow={flow} voice={voice} copy={copy} />
      </div>
    </ChatScroll>
    {step?.state === "record" ? <ChatComposer voiceRequired textDisabled
      className="mx-auto w-full max-w-3xl" mic={voice.mic} recording={voice.recording}
      busy={flow.busy || voice.sending} formAttrs={{ "data-baseline-composer": "" }} /> : null}
  </main>;
}
