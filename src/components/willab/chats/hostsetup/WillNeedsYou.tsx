"use client";

import { useState } from "react";
import type { PriceChange, SetupPart } from "@/services/api/hostSetup";
import { TapRow } from "../../WillQuestion";
import { useUserProfile } from "../../useUserProfile";
import { W } from "./hostSetupCopy";
import { openOverList, useKnownSetup, type OpenDetail } from "./hostSetupDoor";
import { answerPriceChange, useHostWork } from "./hostWork";

/* -------------------------------------------------------------------------- */
/*  Build's "Your chat", in Will's chat (backend N642 item 3, N643 item 4;     */
/*  was N629 item 1's "This needs you:" with every kind, and "And yours to   */
/*  open any time:" with the AI models and your chat, which are Build's tabs */
/*  now). Only for whoever has the ring row `chat_builder`; for everyone     */
/*  else nothing is drawn.                                                    */
/* -------------------------------------------------------------------------- */

export function Row({ title, line, kind, onOpen }: { title: string; line: string; kind: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      data-needs-you={kind}
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-left"
    >
      <span className="flex flex-col gap-0.5">
        <b className="text-[15.5px] font-semibold text-foreground">{title}</b>
        <small className="text-[13.5px] leading-snug text-muted-foreground">{line}</small>
      </span>
      <span aria-hidden className="text-[20px] leading-none text-muted-foreground">›</span>
    </button>
  );
}

export function Said({ children }: { children: string }) {
  return <p className="m-0 text-[15.5px] font-medium text-foreground">{children}</p>;
}

/** "{name} changed the price of their model. Keep it at the new price, or
 *  drop it?" with Keep and Drop (N633 item 4); a tap at a time. */
function PriceLine({ change, coach }: { change: PriceChange; coach: boolean }) {
  const [busy, setBusy] = useState(false);
  const answer = (label: string) => {
    if (busy) return;
    setBusy(true);
    void answerPriceChange(change, label === W.keep, coach).finally(() => setBusy(false));
  };
  return (
    <div data-price-changed={change.model_id} className="flex flex-col gap-2">
      <p className="m-0 rounded-2xl bg-muted px-3.5 py-2.5 text-[15px] leading-snug text-foreground">{W.priceChanged(change.by)}</p>
      <TapRow even labels={[W.keep, W.drop]} disabled={busy} onTap={answer} dataAttr={{ "data-price-taps": "" }} />
    </div>
  );
}

/** One of the chat's parts, its name over what it holds; a tap opens its
 *  step and comes back to Build (backend N642 item 3, N643 item 4). */
function PartRow({ part, onOpen }: { part: SetupPart; onOpen: () => void }) {
  return (
    <button
      type="button"
      data-build-part={part.part}
      onClick={onOpen}
      className="flex w-full flex-col gap-0.5 rounded-2xl border-[1.5px] border-border bg-background px-3.5 py-3 text-left"
    >
      <span className="text-[15px] text-foreground">{part.title}</span>
      {part.value ? <span className="text-[16px] font-semibold text-foreground">{part.value}</span> : null}
    </button>
  );
}

/** Build's "Your chat" (backend N642 item 3, N643 item 4), drawn in Will's
 *  chat above his field: Will's line, the chat's parts, then what needs you
 *  about the chat (the answers to send, a model left out, a changed price).
 *  What is taught (the moments, the examples, a model's check) is in the AI
 *  models tab (BuildModels). Without a chat yet, "Your chat" opens the setup
 *  at "What do you do?". Only for the ring `chat_builder`. */
export default function WillNeedsYou() {
  const { isCoach } = useUserProfile();
  const work = useHostWork(isCoach);
  const setup = useKnownSetup();
  if (!work.ring) return null;
  const over = (detail: OpenDetail) => () => openOverList(detail);
  const recipe = setup?.recipe ?? null;
  const answers = work.lines.find((l) => l.kind === "answers");
  const needs = Boolean(answers) || work.skipped.length > 0 || work.priceChanges.length > 0;
  return (
    <div data-will-needs-you="" className="mr-auto flex w-full max-w-[90%] flex-col gap-2 py-1.5">
      {recipe ? (
        <>
          <Said>{recipe.live ? W.partsOpen : W.partsSaved}</Said>
          {(setup?.parts ?? []).map((part) => (
            <PartRow key={part.part} part={part} onOpen={over({ part: part.part })} />
          ))}
        </>
      ) : (
        <Row kind="chat" title={W.yourChatTitle} line={W.yourChatLine} onOpen={over({ open: "parts" })} />
      )}
      {needs ? <Said>{W.needsYou}</Said> : null}
      {work.skipped.map((by, k) => (
        <p key={`${by}-${k}`} data-left-out="" className="m-0 rounded-2xl bg-muted px-3.5 py-2.5 text-[15px] leading-snug text-foreground">
          {W.leftOut(by)}
        </p>
      ))}
      {work.priceChanges.map((change) => (
        <PriceLine key={change.model_id} change={change} coach={isCoach} />
      ))}
      {answers ? <Row kind="answers" title={W.answersToSend(answers.n)} line={W.answersLine} onOpen={over({ open: "drafts" })} /> : null}
    </div>
  );
}
