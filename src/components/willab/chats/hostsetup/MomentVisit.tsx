"use client";

import { useState } from "react";
import { Mic } from "lucide-react";
import { TopBar } from "../TopBar";
import { OwnAvatar } from "./ChatIconPicker";
import { ChatBarRow } from "../ChatBar";
import {
  AI_DISCLOSURE,
  CHECKPOINTS,
  ENGAGEMENT_QUESTIONS,
  PLACEHOLDER_LINE,
  PRIVACY_LINE,
  deleteSpeakerData,
  intensityWord,
  labelOf,
  placeholderFires,
  placeholderReading,
  readMomentConfig,
  saveSpeaker,
  type QuestionId,
  type SpeakerMoment,
} from "@/lib/willab/chatBuilder/momentFlow";

/* What the speaker meets: baseline, then a recording, then a placeholder
   reading. The reading is not a model. Only this tab keeps it. */

const ANSWERS: Record<QuestionId, [string, string]> = {
  engaged: ["Engaged", "Not engaged"],
  valence: ["Supportive", "Eating me up"],
};

type Step = "baseline" | "record" | "results" | "deleted";

function emptySpeaker(): SpeakerMoment {
  return { answers: {}, voiceSample: false, recorded: false };
}

export default function MomentVisit({ name, onBack }: { name: string; onBack: () => void }) {
  const config = readMomentConfig();
  const questions = ENGAGEMENT_QUESTIONS.filter((q) => config.questions[q.id]);
  const [speaker, setSpeaker] = useState<SpeakerMoment>(emptySpeaker);
  const [step, setStep] = useState<Step>("baseline");
  const minutes = Math.round(config.recordingSeconds / 60);
  const ready = questions.every((q) => speaker.answers[q.id]) && (!config.voiceSample || speaker.voiceSample);
  const keep = (next: SpeakerMoment) => {
    setSpeaker(next);
    saveSpeaker(next);
  };
  const results = placeholderReading(config);
  const claimed = new Set(results.flatMap((row) => row.fired.map((hit) => `${hit.moment}:${hit.intervention}`)));
  const also = placeholderFires(config).filter((hit) => !claimed.has(`${hit.moment}:${hit.intervention}`));
  return (
    <div data-moment-visit="" data-moment-step={step} className="flex min-h-0 flex-1 flex-col bg-background">
      <TopBar
        circle={<OwnAvatar id={`visit-moment-${name}`} name={name} size={36} />}
        title={name}
        subtitle="Only you see this"
        onBack={onBack}
      />
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {step === "baseline" ? (
          <div data-moment-baseline="" className="flex flex-col gap-3">
            <p className="m-0 text-[16px] leading-snug">First, your baseline. It stays in this tab.</p>
            {questions.map((q) => (
              <div key={q.id} className="flex flex-col gap-2">
                <p className="m-0 text-[16px] font-semibold">{q.text}</p>
                <div className="flex flex-wrap gap-2">
                  {ANSWERS[q.id].map((label) => (
                    <button
                      key={label}
                      type="button"
                      data-moment-answer={q.id}
                      aria-pressed={speaker.answers[q.id] === label}
                      onClick={() => keep({ ...speaker, answers: { ...speaker.answers, [q.id]: label } })}
                      className={`min-h-11 rounded-full px-3 text-[15px] font-medium ${speaker.answers[q.id] === label ? "bg-foreground text-background" : "border border-border"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {config.voiceSample ? (
              <button
                type="button"
                data-moment-sample=""
                aria-pressed={speaker.voiceSample}
                onClick={() => keep({ ...speaker, voiceSample: true })}
                className={`min-h-11 rounded-full px-3 text-[15px] font-medium ${speaker.voiceSample ? "bg-foreground text-background" : "border border-border"}`}
              >
                {speaker.voiceSample ? "Normal voice kept in this tab" : "Keep a sample of my normal voice"}
              </button>
            ) : null}
            <p className="m-0 text-[14px] leading-snug text-muted-foreground">The sound is not stored. This preview only remembers that you gave a sample.</p>
          </div>
        ) : null}
        {step === "record" ? (
          <div data-moment-record="" className="flex flex-col gap-3">
            <p className="m-0 text-[16px] font-semibold">Up to {minutes} {minutes === 1 ? "minute" : "minutes"}.</p>
            <p className="m-0 text-[16px] leading-snug">Never longer. If this is the whole presentation, it should hold every point. The fragment is read as a whole before the checkpoints.</p>
            <p className="m-0 text-[14px] leading-snug text-muted-foreground">Nothing is sent. The next screen is a placeholder, not a reading of a recording.</p>
          </div>
        ) : null}
        {step === "results" ? (
          <div data-moment-results="" className="flex flex-col gap-3">
            <p data-moment-disclosure="" className="m-0 text-[15px] font-semibold">{AI_DISCLOSURE}</p>
            <p data-moment-private="" className="m-0 text-[15px] leading-snug">{PRIVACY_LINE}</p>
            <p data-moment-placeholder="" className="m-0 rounded-2xl bg-muted px-3.5 py-2.5 text-[15px] leading-snug">{PLACEHOLDER_LINE}</p>
            {results.map((row) => {
              const stepNote = CHECKPOINTS.find((item) => item.id === row.id)?.note;
              return (
                <section key={row.id} data-moment-checkpoint-result={row.id} className="flex flex-col gap-1 rounded-2xl border border-border px-3.5 py-3">
                  <h2 className="m-0 text-[16px] font-semibold">{row.id}. {row.title}</h2>
                  {stepNote ? <p className="m-0 text-[14px] text-muted-foreground">{stepNote}</p> : null}
                  {row.fired.map((hit) => (
                    <p key={`${hit.moment}-${hit.intervention}`} data-moment-fired={hit.intervention} className="m-0 text-[15px]">
                      {labelOf("intervention", hit.intervention)} · {intensityWord(hit.intensity)} · {labelOf("moment", hit.moment)}
                    </p>
                  ))}
                  {row.quiet.map((id) => (
                    <p key={id} data-moment-quiet={id} className="m-0 text-[15px] text-muted-foreground">{labelOf("intervention", id)} stays quiet</p>
                  ))}
                </section>
              );
            })}
            {also.length ? (
              <section data-moment-also="" className="flex flex-col gap-1">
                <h2 className="m-0 text-[16px] font-semibold">Also fired</h2>
                {also.map((hit) => (
                  <p key={`${hit.moment}-${hit.intervention}`} data-moment-fired={hit.intervention} className="m-0 text-[15px]">
                    {labelOf("intervention", hit.intervention)} · {intensityWord(hit.intensity)} · {labelOf("moment", hit.moment)}
                  </p>
                ))}
              </section>
            ) : null}
          </div>
        ) : null}
        {step === "deleted" ? (
          <p data-moment-deleted="" className="m-0 text-[16px] leading-snug">Deleted. Only you had this, and it is gone.</p>
        ) : null}
      </div>
      {step === "baseline" ? (
        <ChatBarRow>
          <button type="button" data-moment-continue="" disabled={!ready} onClick={() => setStep("record")} className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-40">
            Continue
          </button>
        </ChatBarRow>
      ) : null}
      {step === "results" ? (
        <ChatBarRow>
          <button
            type="button"
            data-moment-delete=""
            onClick={() => {
              deleteSpeakerData();
              setSpeaker(emptySpeaker());
              setStep("deleted");
            }}
            className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-full border border-border text-[15px] font-semibold"
          >
            Delete my data
          </button>
        </ChatBarRow>
      ) : null}
      {step === "record" ? (
        <ChatBarRow>
          <button
            type="button"
            data-moment-record-go=""
            aria-label="Record"
            onClick={() => {
              const next = { ...speaker, recorded: true };
              keep(next);
              setStep("results");
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground"
          >
            <Mic className="h-5 w-5" aria-hidden />
          </button>
          <span className="min-w-0 flex-1 text-[15px]">Record, up to {minutes} {minutes === 1 ? "minute" : "minutes"}</span>
        </ChatBarRow>
      ) : null}
    </div>
  );
}
