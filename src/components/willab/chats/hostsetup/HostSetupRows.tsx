"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readSetup, type SetupRead } from "@/services/api/hostSetup";
import { useUserProfile } from "../../useUserProfile";
import { ChatListRow, LetterCircle } from "../ChatList";
import HostSetup from "./HostSetup";
import HostOwnChat from "./HostOwnChat";
import HostDrafts from "./HostDrafts";
import HostCheck from "./HostCheck";
import ModelsOverlay from "../../models/ModelsOverlay";
import { getModelsChatRows } from "@/services/api/models";
import { MODELS_WORDS } from "../../models/modelsCopy";
import { refreshHostWork } from "./hostWork";
import { W } from "./hostSetupCopy";
import { OPEN_EVENT, knowSetup, type OpenDetail } from "./hostSetupDoor";

/* -------------------------------------------------------------------------- */
/*  The blank setup in the list of chats (backend N616, N618 item 8): the     */
/*  setup over the list, as wide as Will's chat, when a way in opens it       */
/*  (hostSetupDoor.ts); once set up, the host's own chat is a row like any    */
/*  chat, under their name, and opens it as their people meet it. Behind the  */
/*  ring row `chat_builder`: below it the read is 404, nothing is drawn and   */
/*  no way in opens anything.                                                 */
/* -------------------------------------------------------------------------- */

type Open = { at: "setup"; detail: OpenDetail } | { at: "own" };

function useWillColumn() {
  const mark = useRef<HTMLSpanElement | null>(null);
  const [column, setColumn] = useState<Element | null | undefined>(undefined);
  useLayoutEffect(() => setColumn(mark.current?.closest("[data-chats-front]") ?? null), []);
  return { mark, column };
}

export default function HostSetupRows() {
  const [read, setRead] = useState<SetupRead | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [version, setVersion] = useState(0);
  const { profile, isCoach } = useUserProfile();
  const { mark, column } = useWillColumn();
  const [queueTitle, setQueueTitle] = useState("");
  const wantsQueue = open?.at === "setup" && open.detail.open === "teach";
  useEffect(() => {
    if (!wantsQueue) return;
    void getModelsChatRows().then((rows) => {
      const queue = (rows ?? []).find((r) => r.name !== MODELS_WORDS.row_models);
      if (queue) setQueueTitle(queue.name);
    });
  }, [wantsQueue]);
  useEffect(() => {
    let alive = true;
    void readSetup().then((got) => {
      if (!alive) return;
      knowSetup(got);
      setRead(got);
    });
    return () => {
      alive = false;
    };
  }, [version]);
  useEffect(() => () => knowSetup(null), []);
  useEffect(() => {
    const on = (e: Event) => setOpen({ at: "setup", detail: (e as CustomEvent<OpenDetail>).detail ?? {} });
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);
  const name = profile?.first_name ?? read?.own_chat?.title ?? "";
  const close = () => {
    setOpen(null);
    setVersion((v) => v + 1);
    // What needs the person is read again once their work is done (N629).
    void refreshHostWork(isCoach);
  };
  const recipe = read?.recipe ?? null;
  const kind = open?.at === "setup" ? open.detail.open : undefined;
  // The AI models draw their own overlay, in the same column (N629 item 1).
  if (kind === "models" || kind === "teach") {
    return (
      <>
        <span ref={mark} hidden />
        <ModelsOverlay start={kind === "teach" ? { at: "queue" } : { at: "list" }} queueTitle={queueTitle} onClose={close} />
      </>
    );
  }
  const frame = open ? (
    <div data-host-setup="" className="absolute inset-0 z-40 flex flex-col bg-background">
      <OverList open={open} read={read} name={name} onClose={close} />
    </div>
  ) : null;
  return (
    <>
      <span ref={mark} hidden />
      {read?.own_chat && recipe ? (
        <ChatListRow
          id="host-own-chat"
          circle={<LetterCircle id={`own-${read.own_chat.title}`} name={read.own_chat.title} size={48} />}
          title={read.own_chat.title}
          subtitle={W.yourChat}
          preview={read.own_chat.line}
          onOpen={() => setOpen({ at: "own" })}
        />
      ) : null}
      {frame && column !== undefined ? (column ? createPortal(frame, column) : frame) : null}
    </>
  );
}

/** What opens over the list: the drafted answers, one model's check, the
 *  host's own chat, or the setup (its parts). */
function OverList({ open, read, name, onClose }: { open: Open; read: SetupRead | null; name: string; onClose: () => void }) {
  const recipe = read?.recipe ?? null;
  const detail = open.at === "setup" ? open.detail : {};
  if (detail.open === "drafts") return <HostDrafts onClose={onClose} />;
  if (detail.open === "check" && detail.modelId) {
    const checked = (recipe?.models ?? []).find((m) => m.model_id === detail.modelId);
    return <HostCheck modelId={detail.modelId} question={checked?.q ?? ""} onBack={onClose} onDone={onClose} />;
  }
  if (open.at === "own" && recipe) return <HostOwnChat name={read?.own_chat?.title ?? name} recipe={recipe} onBack={onClose} />;
  return (
    <HostSetup
      name={name}
      recipe={recipe}
      parts={detail.parts ? detail.parts : recipe ? { line: null, parts: read?.parts ?? [] } : null}
      cost={read?.cost ?? null}
      ownChat={read?.own_chat ?? null}
      guess={read?.spec_guess ?? null}
      onClose={onClose}
    />
  );
}
