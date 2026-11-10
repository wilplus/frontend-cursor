"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readSetup, type SetupRead } from "@/services/api/hostSetup";
import { useUserProfile } from "../../useUserProfile";
import { ChatListRow, LetterCircle } from "../ChatList";
import HostSetup from "./HostSetup";
import HostOwnChat from "./HostOwnChat";
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
  const { profile } = useUserProfile();
  const { mark, column } = useWillColumn();
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
  };
  const recipe = read?.recipe ?? null;
  const frame = open ? (
    <div data-host-setup="" className="absolute inset-0 z-40 flex flex-col bg-background">
      {open.at === "own" && recipe ? (
        <HostOwnChat name={read?.own_chat?.title ?? name} recipe={recipe} onBack={close} />
      ) : (
        <HostSetup
          name={name}
          recipe={recipe}
          parts={open.at === "setup" && open.detail.parts ? open.detail.parts : recipe ? { line: null, parts: read?.parts ?? [] } : null}
          cost={read?.cost ?? null}
          onClose={close}
        />
      )}
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
