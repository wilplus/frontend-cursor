"use client";

import { useEffect, useState } from "react";
import { openCoachQueue } from "@/lib/willab/coachDoor";
import { readCoachTasks, wantComing, type BuildComing, type CoachTask } from "@/services/api/models";
import { useUserProfile } from "../useUserProfile";
import { W } from "./hostsetup/hostSetupCopy";
import { openOverList, useKnownSetup, type OpenDetail } from "./hostsetup/hostSetupDoor";
import { useHostWork } from "./hostsetup/hostWork";
import { Row, Said } from "./hostsetup/WillNeedsYou";

/* -------------------------------------------------------------------------- */
/*  Build's "AI models" (backend N642 items 3, 5 and 6, N643 item 4): the     */
/*  models and everything a person teaches, each opening where it is worked  */
/*  today, with nothing moved; the queue's tasks shown as models, from GET    */
/*  /v2/models/coach-tasks (each opens the coach's queue, where it is         */
/*  answered); and models that learn from images and from video, coming,      */
/*  with "I want this". For a coach, "Moments to answer" is always here: it   */
/*  is the coach's way to the moments now that the pinned row is their own    */
/*  chat (N642 item 5; the guard is needsYou.test.tsx's N642-5). The examples */
/*  to teach and a model to check keep N629's words. Only for the ring        */
/*  `chat_builder`.                                                           */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

/** The coach's tasks and what is coming, read once; null until read, or
 *  when the backend has no such read (then the moments line as before). */
function useCoachTasks() {
  const [read, setRead] = useState<{ tasks: CoachTask[]; coming: BuildComing[] } | null>(null);
  useEffect(() => {
    let alive = true;
    void readCoachTasks().then((got) => {
      if (alive) setRead(got);
    });
    return () => {
      alive = false;
    };
  }, []);
  const want = (kind: BuildComing["kind"]) => {
    void wantComing(kind).then((told) => {
      if (told) setRead((was) => (was ? { ...was, coming: was.coming.map((c) => (c.kind === kind ? { ...c, wanted: true } : c)) } : was));
    });
  };
  return { read, want };
}

/** "Images, coming. I want this": one mail to the founder, then "Thanks.
 *  I've told Artur." (N642 item 6, as N641 item 3). */
function ComingRow({ coming, onWant }: { coming: BuildComing; onWant: () => void }) {
  return (
    <button
      type="button"
      data-build-coming={coming.kind}
      disabled={coming.wanted}
      onClick={onWant}
      className="flex w-full items-center rounded-2xl border border-border bg-background px-3.5 py-3 text-left text-[15.5px] text-foreground"
    >
      {W.coming(coming.kind, coming.wanted)}
    </button>
  );
}

export default function BuildModels() {
  const { isCoach } = useUserProfile();
  const work = useHostWork(isCoach);
  const setup = useKnownSetup();
  const { read, want } = useCoachTasks();
  const queue = () => openCoachQueue({ fromWill: true });
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
      {/* A coach's moments line never goes, read or not (N642 item 5). */}
      {isCoach && !(read?.tasks ?? []).some((t) => t.kind === "moments") ? (
        <Row kind="moments" title={W.momentsTask} line={W.waiting(count("moments"))} onOpen={queue} />
      ) : null}
      {(read?.tasks ?? []).map((t) => (
        <Row key={t.id} kind={t.kind === "moments" ? "moments" : "task"} title={t.title} line={W.waiting(t.waiting)} onOpen={queue} />
      ))}
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
      {(read?.coming ?? []).map((c) => (
        <ComingRow key={c.kind} coming={c} onWant={() => want(c.kind)} />
      ))}
    </div>
  );
}
