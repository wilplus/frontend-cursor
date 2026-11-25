"use client";

import { useEffect, useRef, useState } from "react";
import BuildModels from "../BuildModels";
import { useUserEmail } from "../../useUserEmail";
import { isFounderEmail } from "@/lib/founder";
import SpeakingCalibration from "./SpeakingCalibration";
import { readKeptReplies, KEPT_MODEL, KEPT_SEND } from "@/services/api/keptReplies";
import Experiments from "./Experiments";
import { choiceBubble, ChoicePair, Frame, Note } from "./bits";
import { stepHelp } from "./help";

/* The AI tile. The builder only opens this. Training and Experiments are
   the two taps. Back steps inside here before it leaves the tile. */

type Door = "home" | "training" | "experiments" | "calibration";

export default function AiDoor({ onBindBack }: { onBindBack: (fn: (() => boolean) | null) => void }) {
  const [door, setDoor] = useState<Door>("home");
  const founder = isFounderEmail(useUserEmail());
  const inner = useRef<(() => boolean) | null>(null);
  const bind = useRef(onBindBack);
  bind.current = onBindBack;

  useEffect(() => {
    bind.current(() => {
      if (door === "experiments" && inner.current?.()) return true;
      if (door === "calibration") {
        setDoor("training");
        return true;
      }
      if (door !== "home") {
        setDoor("home");
        return true;
      }
      return false;
    });
    return () => bind.current(null);
  }, [door]);

  if (door === "calibration" && founder) return <SpeakingCalibration />;
  if (door === "training") return <Training onCalibration={founder ? () => setDoor("calibration") : undefined} />;
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

function Training({ onCalibration }: { onCalibration?: () => void }) {
  const [kept, setKept] = useState(0);
  const [brain, setBrain] = useState<"standard" | "own">("standard");
  useEffect(() => {
    void readKeptReplies().then((rows) => setKept(rows.length));
  }, []);
  const own = kept >= KEPT_MODEL;
  return (
    <Frame screen="training" title="Training">
      <Note>{`You’ve kept ${kept} replies. At ${KEPT_SEND}, the chat can reply on its own. At ${KEPT_MODEL}, you can try a model of your own.`}</Note>
      <ChoicePair
        name="brain"
        value={brain}
        options={[
          { value: "standard", label: "Standard" },
          { value: "own", label: `Your own (unlocks at ${KEPT_MODEL})`, disabled: !own },
        ]}
        onPick={(value) => setBrain(value === "own" && own ? "own" : "standard")}
      />
      {onCalibration && <button className={choiceBubble(false)} onClick={onCalibration}>Speaking Model Calibration</button>}
      <BuildModels />
    </Frame>
  );
}
