"use client";

import { useEffect, useState } from "react";
import { TapRow } from "@/components/willab/WillQuestion";
import {
  HOST_ONLY,
  languageWord,
  LISTEN_QUESTION,
  NOT_ON_YET,
  RESEARCH_BADGE,
  sourceWord,
  type CatalogResult,
  type VoiceModel,
} from "@/lib/willab/experiments/voiceCatalog";
import { listVoiceModels } from "@/services/api/voiceCatalog";

/* The catalog. The names come from the route. A missing route says so. */

export function VoiceModelList({ onPick, onSkip }: {
  onPick: (model: VoiceModel) => void;
  onSkip: () => void;
}) {
  const [catalog, setCatalog] = useState<CatalogResult | null>(null);
  useEffect(() => {
    let live = true;
    void listVoiceModels().then((next) => { if (live) setCatalog(next); });
    return () => { live = false; };
  }, []);
  if (!catalog) return <p data-voice-models="loading" className="m-0 px-3 text-[15px] text-muted-foreground">One moment.</p>;
  if (catalog.state === "host-only") {
    return <p data-voice-host="" className="m-0 px-3 text-[15px] text-foreground">{HOST_ONLY}</p>;
  }
  if (catalog.state === "not-on-yet") {
    return (
      <div data-voice-models="off" className="flex flex-col gap-2 px-3 pb-1">
        <p className="m-0 text-[15px] text-foreground">{LISTEN_QUESTION}</p>
        <p className="m-0 text-[15px] text-muted-foreground">{NOT_ON_YET}</p>
        <TapRow even labels={["Continue"]} onTap={onSkip} dataAttr={{ "data-voice-skip": "" }} />
      </div>
    );
  }
  return (
    <div data-voice-models="on" className="no-scrollbar flex max-h-64 flex-col gap-2 overflow-hidden px-3 pb-1">
      {catalog.models.map((model) => (
        <button
          key={model.id}
          type="button"
          data-voice-model={model.id}
          onClick={() => onPick(model)}
          className="flex flex-col items-start gap-0.5 rounded-2xl border border-border bg-background px-3 py-2 text-left"
        >
          <b className="text-[15px] font-semibold text-foreground">{model.name}</b>
          <span className="text-[13px] leading-snug text-muted-foreground">{model.measures}</span>
          <span className="text-[13px] text-muted-foreground">{languageWord(model.language)} · {sourceWord(model.source)}</span>
          {model.research_only ? (
            <span data-research-badge="" className="text-[12px] font-medium text-muted-foreground">{RESEARCH_BADGE}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
