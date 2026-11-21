"use client";

import { useState } from "react";
import { CALM_MAX, CALM_MIN, HOST_ONLY, NOT_ON_YET, calmFromFile, type BaselinePrompt } from "@/lib/willab/experiments/voiceCatalog";
import { readHold, setCaseFile, writeHold } from "@/lib/willab/experiments/voiceHold";
import { saveExperimentConfig } from "@/services/api/voiceCatalog";
import { readOwnChat } from "@/lib/willab/chatBuilder/ownChat";

/* Which calm prompts, and in which order. The words stay in the prompt
   library. This row only stores the ids. */

export function VoiceCalmEditor({ onDone }: { onDone: () => void }) {
  const known = calmFromFile();
  const [ids, setIds] = useState<string[]>(readHold().prompts.map((row) => row.id));
  const [note, setNote] = useState("");
  const move = (id: string, dir: -1 | 1) => {
    const at = ids.indexOf(id);
    const next = at + dir;
    if (at < 0 || next < 0 || next >= ids.length) return;
    const copy = [...ids];
    const [row] = copy.splice(at, 1);
    copy.splice(next, 0, row);
    setIds(copy);
  };
  const toggle = (id: string) => {
    if (ids.includes(id)) {
      if (ids.length <= CALM_MIN) return;
      setIds(ids.filter((item) => item !== id));
      return;
    }
    if (ids.length >= CALM_MAX) return;
    setIds([...ids, id]);
  };
  const save = () => {
    if (ids.length < CALM_MIN || ids.length > CALM_MAX) return;
    const prompts = ids.flatMap((id) => known.filter((row) => row.id === id));
    writeHold({ prompts });
    void saveExperimentConfig(readOwnChat().id || "your-chat", {
      model_id: readHold().model?.id ?? null,
      baseline_prompt_ids: ids,
    }).then((result) => {
      setNote(result.state === "ready" ? "Saved." : result.state === "host-only" ? HOST_ONLY : NOT_ON_YET);
    });
    onDone();
  };
  return (
    <div data-voice-calm="" className="flex flex-col gap-2 px-1 py-2">
      <p className="m-0 text-[15px] text-muted-foreground">To change the words, edit that prompt in Experiments.</p>
      {known.map((row) => (
        <CalmRow key={row.id} row={row} on={ids.includes(row.id)} onToggle={() => toggle(row.id)} onEarlier={() => move(row.id, -1)} onLater={() => move(row.id, 1)} />
      ))}
      {note ? <p data-voice-save="" className="m-0 text-[14px] text-muted-foreground">{note}</p> : null}
      <label className="text-[15px]">
        A one-page case or slides, if you have them
        <input data-voice-case="" type="file" accept=".pdf,.ppt,.pptx,.odp,.key,application/pdf" className="mt-1 block text-[14px]" onChange={(event) => setCaseFile(event.target.files?.[0] ?? null)} />
      </label>
      <button type="button" data-calm-save="" className="min-h-11 rounded-full bg-primary px-4 text-[16px] font-medium text-primary-foreground" onClick={save}>Save</button>
    </div>
  );
}

function CalmRow({ row, on, onToggle, onEarlier, onLater }: {
  row: BaselinePrompt;
  on: boolean;
  onToggle: () => void;
  onEarlier: () => void;
  onLater: () => void;
}) {
  return (
    <div data-calm-text={row.id} className="flex flex-col gap-1 rounded-xl border border-border px-3 py-2">
      <button type="button" data-calm-pick={row.id} aria-pressed={on} className="text-left text-[15px]" onClick={onToggle}>{on ? "✓ " : ""}{row.text}</button>
      {on ? (
        <span className="flex gap-3 text-[14px]">
          <button type="button" data-calm-earlier={row.id} onClick={onEarlier}>Earlier</button>
          <button type="button" data-calm-later={row.id} onClick={onLater}>Later</button>
        </span>
      ) : null}
    </div>
  );
}
