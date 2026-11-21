"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";
import { readOwnChat } from "@/lib/willab/chatBuilder/ownChat";
import { calmFromFile, HOST_ONLY, NOT_ON_YET } from "@/lib/willab/experiments/voiceCatalog";
import { chooseModel, readHold, subscribeHold, writeHold } from "@/lib/willab/experiments/voiceHold";
import { saveExperimentConfig } from "@/services/api/voiceCatalog";
import { VoiceCalmEditor } from "./VoiceCalm";
import { VoiceModelList } from "./VoiceModelList";

/* Settings rows for the voice model. They are not recipe rows. */

export function VoiceSettings() {
  const hold = useSyncExternalStore(subscribeHold, readHold, readHold);
  const [open, setOpen] = useState<"model" | "calm" | null>(null);
  const [note, setNote] = useState("");
  const pick = (model: Parameters<typeof chooseModel>[0]) => {
    const prompts = model.needs_baseline ? (hold.prompts.length >= 3 ? hold.prompts : calmFromFile()) : [];
    chooseModel(model);
    writeHold({ prompts });
    void saveExperimentConfig(readOwnChat().id || "your-chat", {
      model_id: model.id,
      baseline_prompt_ids: prompts.map((row) => row.id),
    }).then((result) => setNote(result.state === "ready" ? "Saved." : result.state === "host-only" ? HOST_ONLY : NOT_ON_YET));
    setOpen(null);
  };
  return (
    <section data-voice-settings="" className="border-t border-border px-4 py-3">
      <button type="button" data-voice-row="model" className="flex w-full flex-col items-start py-2 text-left" onClick={() => setOpen(open === "model" ? null : "model")}>
        <span className="text-[18px] font-semibold">Listen to how people speak</span>
        <span className="text-[16px]">{hold.model ? hold.model.name : "Not set"}</span>
      </button>
      {hold.model?.needs_baseline ? (
        <button type="button" data-voice-row="calm" className="flex w-full flex-col items-start py-2 text-left" onClick={() => setOpen(open === "calm" ? null : "calm")}>
          <span className="text-[18px] font-semibold">Calm questions first</span>
          <span className="text-[16px] text-muted-foreground">{hold.prompts.length ? `${hold.prompts.length} questions` : "Not set"}</span>
        </button>
      ) : null}
      {open === "model" ? <VoiceModelList onSkip={() => setOpen(null)} onPick={pick} /> : null}
      {open === "calm" ? <VoiceCalmEditor onDone={() => setOpen(null)} /> : null}
      {note ? <p data-voice-save="" className="m-0 text-[14px] text-muted-foreground">{note}</p> : null}
    </section>
  );
}
