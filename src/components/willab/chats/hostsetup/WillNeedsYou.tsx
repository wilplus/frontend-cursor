"use client";

import { useState } from "react";
import { openCoachQueue } from "@/lib/willab/coachDoor";
import type { PriceChange } from "@/services/api/hostSetup";
import { TapRow } from "../../WillQuestion";
import { useUserProfile } from "../../useUserProfile";
import { W } from "./hostSetupCopy";
import { openOverList, type OpenDetail } from "./hostSetupDoor";
import { answerPriceChange, useHostWork, type WorkKind } from "./hostWork";

/* -------------------------------------------------------------------------- */
/*  What needs you, in Will's chat (backend N629 item 1): "This needs you:"  */
/*  and one line per kind with something waiting, each opening its work as   */
/*  it is; or "Nothing needs you now." Then "And yours to open any time:"    */
/*  with the AI models and, once set up, your chat. Only for whoever has the */
/*  ring row `chat_builder`; for everyone else nothing is drawn.             */
/* -------------------------------------------------------------------------- */

function Row({ title, line, kind, onOpen }: { title: string; line: string; kind: string; onOpen: () => void }) {
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

function Said({ children }: { children: string }) {
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

export default function WillNeedsYou() {
  const { isCoach } = useUserProfile();
  const work = useHostWork(isCoach);
  if (!work.ring) return null;
  const over = (detail: OpenDetail) => () => openOverList(detail);
  const kinds: Record<WorkKind, { title: (n: number) => string; line: string; open: () => void }> = {
    answers: { title: W.answersToSend, line: W.answersLine, open: over({ open: "drafts" }) },
    moments: { title: W.momentsToAnswer, line: W.momentsLine, open: () => openCoachQueue({ fromWill: true }) },
    examples: { title: W.examplesToTeach, line: W.examplesLine, open: over({ open: "teach" }) },
    check: { title: W.modelsToCheck, line: W.modelsLine, open: over({ open: "check", modelId: work.checkModel ?? undefined }) },
  };
  return (
    <div data-will-needs-you="" className="mr-auto flex w-full max-w-[90%] flex-col gap-2 py-1.5">
      {work.lines.length || work.skipped.length || work.priceChanges.length ? (
        <>
          <Said>{W.needsYou}</Said>
          {work.skipped.map((by, k) => (
            <p key={`${by}-${k}`} data-left-out="" className="m-0 rounded-2xl bg-muted px-3.5 py-2.5 text-[15px] leading-snug text-foreground">
              {W.leftOut(by)}
            </p>
          ))}
          {work.priceChanges.map((change) => (
            <PriceLine key={change.model_id} change={change} coach={isCoach} />
          ))}
          {work.lines.map(({ kind, n }) => (
            <Row key={kind} kind={kind} title={kinds[kind].title(n)} line={kinds[kind].line} onOpen={kinds[kind].open} />
          ))}
        </>
      ) : (
        <Said>{W.nothingNeedsYou}</Said>
      )}
      <Said>{W.yoursAnyTime}</Said>
      <Row kind="models" title={W.aiModels} line={W.aiModelsLine} onOpen={over({ open: "models" })} />
      {/* With a chat set up, its parts; without one (a new account, or a chat
          from the older builder), the setup from "What do you do?". */}
      <Row kind="chat" title={W.yourChatTitle} line={W.yourChatLine} onOpen={over({ open: "parts" })} />
    </div>
  );
}
