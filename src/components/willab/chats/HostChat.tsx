"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getHost, type Host } from "@/services/api/assistants";
import type { ChatMessage } from "@/services/api/chats";
import { AssistantMark } from "./ChatList";

/* -------------------------------------------------------------------------- */
/*  A host's own chat, as the person who joined it meets it (backend N578     */
/*  item 1, N580 item 3, N586 item 1, N590 item 2): on top, who the host is   */
/*  and what you can learn with them, in the host's own words; then the       */
/*  host's welcome, first, as their assistant's messages, each labelled       */
/*  "{name}'s assistant" with the assistant's mark (an AI answers for them,  */
/*  AI Act article 50). The welcome rows are the backend's (meta.assistant);  */
/*  GET /v2/chats/<id>/host says whose assistant it is. Behind the ring row  */
/*  `chat_builder`: without it, or for a host with no recipe, the read is     */
/*  {host: null} (or 404 on a backend without the route) and the chat is as   */
/*  it was.                                                                   */
/* -------------------------------------------------------------------------- */

/** The host's chat as the person in it reads it, or null. */
export function useHost(chatId: string): Host | null {
  const [host, setHost] = useState<Host | null>(null);
  useEffect(() => {
    setHost(null);
    let alive = true;
    void getHost(chatId).then((got) => {
      if (alive) setHost(got);
    });
    return () => {
      alive = false;
    };
  }, [chatId]);
  return host;
}

/** Who the host is and what you can learn with them (N586 item 1), above
 *  the messages; nothing without lines. */
export function AssistantAbout({ host }: { host: Host | null }) {
  if (!host || host.about.length === 0) return null;
  return (
    <div data-host-about="" className="mb-2 flex max-w-[86%] flex-col gap-1 self-center rounded-xl bg-muted px-3 py-2 text-center text-[13.5px] leading-snug text-foreground">
      {host.about.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

/** A message the assistant wrote for the host (meta.assistant), with its
 *  label above it; any other message as it is. */
export function AssistantSays({ name, message, children }: { name: string | null; message: ChatMessage; children: ReactNode }) {
  if (!name || message.mine || message.meta?.assistant !== true) return <>{children}</>;
  return (
    <div data-assistant-says="" className="flex flex-col gap-1">
      <span className="mr-auto flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        <AssistantMark label={name} inline />
        {name}
      </span>
      {children}
    </div>
  );
}
