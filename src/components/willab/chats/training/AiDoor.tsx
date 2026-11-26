"use client";

import { useEffect, useRef } from "react";
import BuildModels from "../BuildModels";
import { useUserEmail } from "../../useUserEmail";
import { isFounderEmail } from "@/lib/founder";
import TrainingPanel from "./TrainingPanel";

/* The AI tile (backend N704). The founder's is the Training panel: one
   question per screen for the moment picker and the intervention picker.
   Anyone else's lists their own models and what they teach. No chat, no
   Experiments. Back leaves the tile. */

export default function AiDoor({ onBindBack }: { onBindBack: (fn: (() => boolean) | null) => void }) {
  const founder = isFounderEmail(useUserEmail());
  const bind = useRef(onBindBack);
  bind.current = onBindBack;
  useEffect(() => {
    bind.current(null);
  }, []);
  if (founder) return <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto"><TrainingPanel /></div>;
  return (
    <div data-ai-models="" className="no-scrollbar mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto px-4">
      <BuildModels />
    </div>
  );
}
