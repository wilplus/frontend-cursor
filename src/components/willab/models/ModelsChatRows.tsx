"use client";

import { useEffect, useState } from "react";
import { getModelsChatRows, type ModelsChatRow } from "@/services/api/models";
import { ChatListRow } from "../chats/ChatList";
import { MODELS_WORDS as W } from "./modelsCopy";
import ModelsOverlay, { type ModelsScreen } from "./ModelsOverlay";

/* -------------------------------------------------------------------------- */
/*  The rows under the people in the list of chats (backend N528 item 1,      */
/*  N563 item 1; the locked prototype's d:1 and q:1): "Your queue" for        */
/*  whoever teaches a model, with "12 examples wait · 3 models", then the     */
/*  section "AI models" and its row "Teach one, or start your own". Both      */
/*  rows and their words come from the backend (chat_rows).                  */
/*                                                                            */
/*  Ring 6, feature `ai_models`: below it /v2/models/rows answers 404 and     */
/*  nothing is drawn, not even the section's name. N580 item 2 moves the      */
/*  queue inside Will's chat once Will's split is built; until then it is     */
/*  this row.                                                                 */
/* -------------------------------------------------------------------------- */

function QueueIcon() {
  return (
    <span aria-hidden className="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-full bg-[#FFF1E7]">
      {[0, 1, 2].map((i) => (
        <i key={i} className="block h-[2.5px] w-5 rounded-sm bg-[#C2410C]" />
      ))}
    </span>
  );
}

function JarIcon() {
  return (
    <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E2F4EB]">
      <i
        className="block h-[22px] w-[18px] rounded-[2px_2px_7px_7px] border-[2.5px] border-t-0 border-[#2F9E6E]"
        style={{ background: "linear-gradient(transparent 45%, #2F9E6E 45%)" }}
      />
    </span>
  );
}

export default function ModelsChatRows() {
  const [rows, setRows] = useState<ModelsChatRow[] | null>(null);
  const [open, setOpen] = useState<ModelsScreen | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    void getModelsChatRows().then((got) => {
      if (alive) setRows(got);
    });
    return () => {
      alive = false;
    };
  }, [version]);
  if (!rows?.length) return null;
  const models = rows.find((r) => r.name === W.row_models);
  const queue = rows.find((r) => r !== models) ?? null;
  return (
    <>
      {queue ? (
        <ChatListRow id="models-queue" circle={<QueueIcon />} title={queue.name} preview={queue.line} isNew={/^[1-9]/.test(queue.line)} onOpen={() => setOpen({ at: "queue" })} />
      ) : null}
      {models ? (
        <>
          <div data-models-section className="px-4 pb-1 pt-3.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{models.name}</div>
          <ChatListRow id="models" circle={<JarIcon />} title={models.name} preview={models.line} onOpen={() => setOpen({ at: "list" })} />
        </>
      ) : null}
      {open ? (
        <ModelsOverlay
          start={open}
          queueTitle={queue?.name ?? ""}
          onClose={() => {
            setOpen(null);
            setVersion((v) => v + 1);
          }}
        />
      ) : null}
    </>
  );
}
