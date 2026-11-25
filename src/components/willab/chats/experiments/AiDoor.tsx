"use client";

import { useEffect, useRef, useState } from "react";
import BuildModels from "../BuildModels";
import { useUserEmail } from "../../useUserEmail";
import { isFounderEmail } from "@/lib/founder";
import SpeakingCalibration from "./SpeakingCalibration";
import Experiments from "./Experiments";
import { choiceBubble, Frame, Note } from "./bits";
import { stepHelp } from "./help";

/* The AI tile. The builder only opens this. Training and Experiments are
   the two taps. Back steps inside here before it leaves the tile. */

type Door = "home" | "training" | "experiments";

export default function AiDoor({ onBindBack }: { onBindBack: (fn: (() => boolean) | null) => void }) {
  const [door, setDoor] = useState<Door>("home");
  const founder = isFounderEmail(useUserEmail());
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

  // The founder's Training is the labeling page itself, the coach queues on
  // top (backend N702); everyone else keeps their models and what they teach.
  if (door === "training" && founder) return <SpeakingCalibration top={<BuildModels queuesOnly />} />;
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
      className={choiceBubble(filled)}
    >
      {label}
    </button>
  );
  return (
    <Frame
      screen="ai"
      data-ai-split=""
      foot={
        <div data-ai-replies="" className="flex flex-wrap justify-end gap-2">
          {tap("training", "Training", false)}
          {tap("experiments", "Experiments", true)}
        </div>
      }
    >
      <Note>{stepHelp("ai").about}</Note>
    </Frame>
  );
}

function Training() {
  return (
    <Frame screen="training" title="Training">
      <BuildModels />
    </Frame>
  );
}
