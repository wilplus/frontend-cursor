"use client";

import { openCoachQueue } from "@/lib/willab/coachDoor";
import { useUserProfile } from "../useUserProfile";
import { W } from "./hostsetup/hostSetupCopy";
import { openOverList, useKnownSetup, type OpenDetail } from "./hostsetup/hostSetupDoor";
import { useHostWork } from "./hostsetup/hostWork";
import { Row, Said } from "./hostsetup/WillNeedsYou";

/* -------------------------------------------------------------------------- */
/*  Build's "AI models" (backend N642 items 3 and 5, N643 item 4): the models */
/*  and everything a person teaches, each opening where it is worked today,  */
/*  with nothing moved. For a coach, "Moments to answer" is always here: it   */
/*  is the coach's way to the moments once Will's row is their own chat       */
/*  (N642 item 5; the guard is needsYou.test.tsx's N642-5). The examples to  */
/*  teach and a model to check keep N629's words. Only for the ring           */
/*  `chat_builder`.                                                           */
/* -------------------------------------------------------------------------- */

export default function BuildModels() {
  const { isCoach } = useUserProfile();
  const work = useHostWork(isCoach);
  const setup = useKnownSetup();
  const over = (detail: OpenDetail) => () => openOverList(detail);
  const count = (kind: "moments" | "examples" | "check") => work.lines.find((l) => l.kind === kind)?.n ?? 0;
  const examples = count("examples");
  const check = count("check");
  return (
    <div data-build-models="" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
      <Said>{W.yourModels}</Said>
      {(setup?.recipe?.models ?? []).map((m, k) => (
        <Row
          key={m.model_id ?? `${m.q}-${k}`}
          kind="model"
          title={m.q}
          line={m.own ? W.teachIt : W.modelBy(m.by ?? "")}
          onOpen={over(m.model_id ? { open: "models", modelId: m.model_id } : { open: "models" })}
        />
      ))}
      {isCoach ? (
        <Row kind="moments" title={W.momentsTask} line={W.waiting(count("moments"))} onOpen={() => openCoachQueue({ fromWill: true })} />
      ) : null}
      {examples ? <Row kind="examples" title={W.examplesToTeach(examples)} line={W.examplesLine} onOpen={over({ open: "teach" })} /> : null}
      {check ? (
        <Row kind="check" title={W.modelsToCheck(check)} line={W.modelsLine} onOpen={over({ open: "check", modelId: work.checkModel ?? undefined })} />
      ) : null}
      <button
        type="button"
        data-build-start=""
        onClick={over({ open: "start" })}
        className="flex w-full items-center rounded-2xl border border-border bg-background px-3.5 py-3 text-left text-[15.5px] font-semibold text-foreground"
      >
        {W.startYourOwn}
      </button>
    </div>
  );
}
