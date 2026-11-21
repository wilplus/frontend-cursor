"use client";

import { useEffect, useRef, useState } from "react";
import { BarBox, ChatBarRow } from "@/components/willab/chats/ChatBar";
import BuildModels from "../BuildModels";
import { readKeptReplies, KEPT_MODEL, KEPT_SEND } from "@/services/api/keptReplies";
import Experiments from "./Experiments";

/* The AI tile. The builder only opens this. Training and Experiments are
   the two taps. Back steps inside here before it leaves the tile. */

type Door = "home" | "training" | "experiments";

export default function AiDoor({ onBindBack }: { onBindBack: (fn: (() => boolean) | null) => void }) {
  const [door, setDoor] = useState<Door>("home");
  const inner = useRef<(() => boolean) | null>(null);
  const bind = useRef(onBindBack);
  bind.current = onBindBack;

  useEffect(() => {
    bind.current(() => {
      if (door === "experiments" && inner.current?.()) return true;
      if (door !== "home") {
        setDoor("home");
        return true;
      }
      return false;
    });
    return () => bind.current(null);
  }, [door]);

  if (door === "training") return <Training />;
  if (door === "experiments") return <Experiments onBindBack={(fn) => { inner.current = fn; }} />;
  return <AiHome onPick={setDoor} />;
}

function AiHome({ onPick }: { onPick: (door: Door) => void }) {
  const tap = (id: "training" | "experiments", label: string, filled: boolean) => (
    <button
      type="button"
      data-ai-choice={id}
      onClick={() => onPick(id)}
      className={`min-h-[44px] rounded-[22px] border-[1.5px] border-primary px-4 py-[9px] text-[15px] font-semibold ${filled ? "bg-primary text-primary-foreground" : "bg-background text-primary"}`}
    >
      {label}
    </button>
  );
  return (
    <div data-ai-split="" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 items-center px-4">
        <p data-row="app" className="m-0 max-w-[88%] rounded-2xl bg-muted px-3.5 py-2.5 text-[16px] leading-snug">Training, or experiments?</p>
      </div>
      <div data-ai-replies="" className="flex justify-end gap-2 px-3 pb-1">
        {tap("training", "Training", false)}
        {tap("experiments", "Experiments", true)}
      </div>
      <ChatBarRow data-ai-composer="">
        <BarBox hint="Type your answer" open onSend={async () => true} />
      </ChatBarRow>
    </div>
  );
}

function Training() {
  const [kept, setKept] = useState(0);
  const [brain, setBrain] = useState<"standard" | "own">("standard");
  useEffect(() => {
    void readKeptReplies().then((rows) => setKept(rows.length));
  }, []);
  const own = kept >= KEPT_MODEL;
  return (
    <div data-exp-screen="training" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2 px-4 pb-2 pt-3">
        <p className="m-0 text-[15px] leading-snug">{kept} kept. {KEPT_SEND} lets it send on its own. About {KEPT_MODEL}, a model of your own makes sense.</p>
        <p className="m-0 text-[13px] text-muted-foreground">Which brain?</p>
        <div data-pair="brain" className="flex gap-2">
          <button type="button" data-choice="standard" aria-pressed={brain === "standard"} onClick={() => setBrain("standard")} className={`min-h-12 flex-1 rounded-full px-3 text-[16px] font-semibold ${brain === "standard" ? "bg-foreground text-background" : "border-[1.5px] border-border bg-background"}`}>Standard</button>
          <button type="button" data-choice="own" aria-pressed={brain === "own"} disabled={!own} onClick={() => { if (own) setBrain("own"); }} className={`min-h-12 flex-1 rounded-full border-[1.5px] border-border px-3 text-[16px] font-semibold disabled:opacity-40 ${brain === "own" ? "bg-foreground text-background" : "bg-background"}`}>Your own (unlocks at {KEPT_MODEL})</button>
        </div>
      </div>
      <BuildModels />
    </div>
  );
}
