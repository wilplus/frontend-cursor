"use client";

import { W } from "./hostSetupCopy";
import { Btn, Frame, Opt, Say, Two } from "./SetupBits";

/* -------------------------------------------------------------------------- */
/*  A model made in blocks, one choice per screen (backend N636 item 6,       */
/*  N637; the pinned prototype's steps ownwhy, gives, base and stack). The    */
/*  same screens in the chat setup (HostSetup) and on the AI models page      */
/*  (ModelBlocks, N636 item 7): one way to start a model.                     */
/* -------------------------------------------------------------------------- */

export type BlockKey = "model" | "gives" | "base";

/** Why one's own model: two lines, then "Not now" or "Train my own". */
export function OwnWhyScreen({ onBack, onNo, onYes }: { onBack: () => void; onNo: () => void; onYes: () => void }) {
  return (
    <Frame onBack={onBack} foot={<Two left={<Btn out label={W.notNow} onClick={onNo} />} right={<Btn label={W.trainMyOwn} onClick={onYes} />} />}>
      {W.ownSay.map((line) => <Say key={line}>{line}</Say>)}
    </Frame>
  );
}

/** "What should it give back?": only a choice that is ready taps. */
export function GivesScreen({ onBack, on, onPick }: { onBack: () => void; on: string | null; onPick: (id: string) => void }) {
  return (
    <Frame onBack={onBack}>
      <Say>{W.givesSay}</Say>
      {W.gives.map(([id, title]) => (
        <Opt key={id} title={title} on={on === id} disabled={id !== "pick"} onClick={() => onPick(id)} />
      ))}
    </Frame>
  );
}

/** "What should it be built on?": only GPT taps (N634 item 1). */
export function BaseScreen({ onBack, on, onPick }: { onBack: () => void; on: string | null; onPick: (id: string) => void }) {
  return (
    <Frame onBack={onBack}>
      <Say>{W.baseSay}</Say>
      {W.bases.map(([id, title]) => (
        <Opt key={id} title={title} on={on === id} disabled={id !== "gpt"} onClick={() => onPick(id)} />
      ))}
    </Frame>
  );
}

export const BLOCK = "rounded-[10px] bg-foreground px-4 py-3.5 text-left text-[16px] font-semibold text-background";

/** "Your model. Tap a block to change it.": four dark blocks; the question,
 *  what it gives back and what it is built on each open their one choice. */
export function BlocksScreen({ onBack, q, gives, onOpen, onTeach, busy = false }: {
  onBack: () => void;
  q: string;
  gives: string | null;
  onOpen: (block: BlockKey) => void;
  onTeach: () => void;
  busy?: boolean;
}) {
  const title = W.gives.find(([id]) => id === (gives ?? "pick"))?.[1] ?? W.gives[0][1];
  return (
    <Frame onBack={onBack} foot={<Btn label={W.teachIt} disabled={busy} onClick={onTeach} />}>
      <Say>{W.stackSay}</Say>
      <div data-model-stack="" className="flex flex-col gap-[3px]">
        <button type="button" className={BLOCK} onClick={() => onOpen("model")}>{q}</button>
        <button type="button" className={BLOCK} onClick={() => onOpen("gives")}>{W.givesBlock(title)}</button>
        <button type="button" className={BLOCK} onClick={() => onOpen("base")}>{W.builtOnGpt}</button>
        <div className={BLOCK}>{W.taughtByYou}</div>
      </div>
    </Frame>
  );
}
