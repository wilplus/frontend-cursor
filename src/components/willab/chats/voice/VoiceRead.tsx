"use client";

import { axisTitle } from "@/lib/willab/experiments/words";
import { LISTENING, LOCKED_STEP, NOT_ON_YET, stepLocked, type VoiceTip } from "@/lib/willab/experiments/voiceCatalog";
import type { AnalyzeTake } from "@/lib/willab/experiments/types";

/* The volunteer's reading. A locked step has no number. The tip is the
   intervention text, and only when the route sent one. */

export function VoiceListening({ off = false }: { off?: boolean }) {
  return <p data-voice-listening="" className="m-0 max-w-[86%] self-start rounded-2xl bg-muted px-3.5 py-2.5 text-[16px]">{off ? NOT_ON_YET : LISTENING}</p>;
}

export function VoiceRead({ take, tips }: { take: AnalyzeTake; tips: VoiceTip[] }) {
  return (
    <div data-voice-read="" className="flex max-w-[86%] flex-col gap-1 self-start rounded-2xl bg-muted px-3.5 py-2.5 text-[16px]">
      <p className="m-0 text-[13px] text-muted-foreground">Only you see this.</p>
      {take.order.map((name) => {
        const locked = stepLocked(take, name);
        return (
          <p key={name} data-voice-step={name} data-locked={locked ? "" : undefined} className="m-0">
            <b className="font-semibold">{axisTitle(name)}. </b>
            {locked ? LOCKED_STEP : "Clear enough."}
          </p>
        );
      })}
      {tips.map((tip) => <p key={tip.id} data-voice-tip="" className="m-0">{tip.text}</p>)}
    </div>
  );
}
