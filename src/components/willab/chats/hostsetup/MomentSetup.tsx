"use client";

import { useState } from "react";
import { TopBar } from "../TopBar";
import { OwnAvatar } from "./ChatIconPicker";
import { ChatBarRow } from "../ChatBar";
import { W } from "./hostSetupCopy";
import {
  CHECKPOINTS,
  ENGAGEMENT_QUESTIONS,
  INTERVENTIONS,
  MATCH_SHAPES,
  MOMENTS,
  intensityWord,
  labelOf,
  nextIntensity,
  nextThreshold,
  readMomentConfig,
  saveMomentConfig,
  thresholdWord,
  type MomentConfig,
} from "@/lib/willab/chatBuilder/momentFlow";

/* The host's settings for a Moment -> Intervention chat. A speaker's
   answers are not on this screen. */

function Choice({ on, label, onClick, attr }: { on: boolean; label: string; onClick: () => void; attr: Record<string, string> }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      {...attr}
      className={`min-h-11 rounded-full px-3 text-left text-[15px] font-medium ${on ? "bg-foreground text-background" : "border border-border bg-background text-foreground"}`}
    >
      {label}
    </button>
  );
}

export default function MomentSetup({ name, onBack, onTry }: { name: string; onBack: () => void; onTry: () => void }) {
  const [config, setConfig] = useState<MomentConfig>(() => readMomentConfig());
  const [saved, setSaved] = useState(false);
  const set = (next: MomentConfig) => {
    setSaved(false);
    setConfig(next);
  };
  const save = () => {
    setConfig(saveMomentConfig(config));
    setSaved(true);
  };
  return (
    <div data-moment-setup="" className="flex min-h-0 flex-1 flex-col bg-background">
      <TopBar
        circle={<OwnAvatar id={`moment-${name}`} name={name} size={36} />}
        title="Moments"
        subtitle={W.youRunIt}
        onBack={onBack}
      />
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-[16px] font-semibold">Recording</h2>
          <p className="m-0 text-[15px] leading-snug">Five minutes at most, and never longer. A shorter talk should hold every point.</p>
          <div className="flex flex-wrap gap-2" data-moment-limit="">
            {[1, 2, 3, 4, 5].map((minutes) => (
              <Choice
                key={minutes}
                on={config.recordingSeconds === minutes * 60}
                label={`${minutes} min`}
                attr={{ "data-moment-minutes": String(minutes) }}
                onClick={() => set({ ...config, recordingSeconds: minutes * 60 })}
              />
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-[16px] font-semibold">Baseline</h2>
          <p className="m-0 text-[15px] leading-snug">Engagement questions, then a short sample of their normal voice. The arousal check needs that sample.</p>
          {ENGAGEMENT_QUESTIONS.map((q) => (
            <Choice
              key={q.id}
              on={config.questions[q.id]}
              label={q.text}
              attr={{ "data-moment-question": q.id }}
              onClick={() => set({ ...config, questions: { ...config.questions, [q.id]: !config.questions[q.id] } })}
            />
          ))}
          <Choice
            on={config.voiceSample}
            label="Normal voice sample"
            attr={{ "data-moment-voice": "" }}
            onClick={() => set({ ...config, voiceSample: !config.voiceSample })}
          />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-[16px] font-semibold">Checkpoints</h2>
          <p className="m-0 text-[15px] leading-snug">The same five, in any context. A quiet one is skipped.</p>
          {CHECKPOINTS.map((step) => (
            <div key={step.id} data-moment-checkpoint={step.id} className="flex flex-col gap-2 rounded-2xl border border-border px-3 py-3">
              <Choice
                on={config.checkpoints[step.id]}
                label={`${step.id}. ${step.title}`}
                attr={{ "data-moment-checkpoint-toggle": step.id }}
                onClick={() => set({ ...config, checkpoints: { ...config.checkpoints, [step.id]: !config.checkpoints[step.id] } })}
              />
              <p className="m-0 text-[14px] leading-snug text-muted-foreground">{step.note}</p>
              <p className="m-0 text-[14px]">
                {config.checkpointInterventions[step.id].map((id) => labelOf("intervention", id)).join(", ")}
              </p>
            </div>
          ))}
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-[16px] font-semibold">Matching</h2>
          <p className="m-0 text-[15px] leading-snug">Each moment and each intervention is its own pattern. They can fire together. How close the match is sets how strongly it fires.</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[14px] text-muted-foreground">
            {MATCH_SHAPES.map((shape) => <li key={shape.id}>{shape.label}</li>)}
          </ul>
          {config.mappings.map((row) => (
            <div key={row.id} data-moment-mapping={row.id} className="flex flex-col gap-2 rounded-2xl border border-border px-3 py-3">
              <Choice
                on={row.on}
                label={`${labelOf("moment", row.moment)} → ${labelOf("intervention", row.intervention)}`}
                attr={{ "data-moment-mapping-toggle": row.id }}
                onClick={() => set({
                  ...config,
                  mappings: config.mappings.map((item) => (item.id === row.id ? { ...item, on: !item.on } : item)),
                })}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-moment-threshold={row.id}
                  onClick={() => set({
                    ...config,
                    mappings: config.mappings.map((item) => (item.id === row.id ? { ...item, threshold: nextThreshold(item.threshold) } : item)),
                  })}
                  className="min-h-11 rounded-full border border-border px-3 text-[15px]"
                >
                  {thresholdWord(row.threshold)}
                </button>
                <button
                  type="button"
                  data-moment-intensity={row.id}
                  onClick={() => set({
                    ...config,
                    mappings: config.mappings.map((item) => (item.id === row.id ? { ...item, intensity: nextIntensity(item.intensity) } : item)),
                  })}
                  className="min-h-11 rounded-full border border-border px-3 text-[15px]"
                >
                  {intensityWord(row.intensity)}
                </button>
              </div>
            </div>
          ))}
          <p className="m-0 text-[13px] text-muted-foreground">Moments: {MOMENTS.map((m) => m.label).join(", ")}. Interventions: {INTERVENTIONS.map((m) => m.label).join(", ")}.</p>
        </section>
        <Choice
          on={config.meetVisitors}
          label="Visitors start with the baseline"
          attr={{ "data-moment-meet": "" }}
          onClick={() => set({ ...config, meetVisitors: !config.meetVisitors })}
        />
        {saved ? <p role="status" data-moment-saved="" className="m-0 text-[15px]">Saved on this device.</p> : null}
      </div>
      <ChatBarRow>
        <button type="button" data-moment-save="" onClick={save} className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-full bg-foreground text-[15px] font-semibold text-background">
          Save
        </button>
        <button type="button" data-moment-try="" onClick={() => { save(); onTry(); }} className="flex h-11 shrink-0 items-center justify-center rounded-full border border-border px-3 text-[15px] font-semibold">
          Try it
        </button>
      </ChatBarRow>
    </div>
  );
}
