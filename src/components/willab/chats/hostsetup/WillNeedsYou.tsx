"use client";

import { openCoachQueue } from "@/lib/willab/coachDoor";
import { useUserProfile } from "../../useUserProfile";
import { W } from "./hostSetupCopy";
import { openOverList, type OpenDetail } from "./hostSetupDoor";
import { useHostWork, type WorkKind } from "./hostWork";

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

export default function WillNeedsYou() {
  const { isCoach } = useUserProfile();
  const work = useHostWork(isCoach);
  if (!work.ring) return null;
  const over = (detail: OpenDetail) => () => openOverList(detail);
  const kinds: Record<WorkKind, { title: (n: number) => string; line: string; open: () => void }> = {
    answers: { title: W.answersToSend, line: W.answersLine, open: over({ open: "drafts" }) },
    moments: { title: W.momentsToAnswer, line: W.momentsLine, open: openCoachQueue },
    examples: { title: W.examplesToTeach, line: W.examplesLine, open: over({ open: "teach" }) },
    check: { title: W.modelsToCheck, line: W.modelsLine, open: over({ open: "check", modelId: work.checkModel ?? undefined }) },
  };
  return (
    <div data-will-needs-you="" className="mr-auto flex w-full max-w-[90%] flex-col gap-2 py-1.5">
      {work.lines.length ? (
        <>
          <Said>{W.needsYou}</Said>
          {work.lines.map(({ kind, n }) => (
            <Row key={kind} kind={kind} title={kinds[kind].title(n)} line={kinds[kind].line} onOpen={kinds[kind].open} />
          ))}
        </>
      ) : (
        <Said>{W.nothingNeedsYou}</Said>
      )}
      <Said>{W.yoursAnyTime}</Said>
      <Row kind="models" title={W.aiModels} line={W.aiModelsLine} onOpen={over({ open: "models" })} />
      {work.ownChat ? <Row kind="chat" title={W.yourChatTitle} line={W.yourChatLine} onOpen={over({ open: "parts" })} /> : null}
    </div>
  );
}
