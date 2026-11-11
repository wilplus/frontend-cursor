"use client";

import { useState } from "react";
import type { ChatMessage } from "@/services/api/chats";
import { photoWaits } from "./ChatBar";
import { ChatRow, PhotoFull, SENT, answerWaits, setupWaits, takeWaits } from "./ChatThread";

/* -------------------------------------------------------------------------- */
/*  One of the host's chat's own messages, drawn among the Takes of a host's  */
/*  chat that takes Takes (backend N648 item 8), as the chat itself draws it  */
/*  (ChatRow): theirs grey on the left, mine orange on the right, a voice    */
/*  with "Read it", a photo full size on a tap. A message that asks           */
/*  something of the person (answers to tap, "Record your answer", a photo,  */
/*  their Take to answer) opens the chat as it is today in one tap, where    */
/*  it is answered, so nothing asked can be missed here.                      */
/* -------------------------------------------------------------------------- */

/** The messages that wait for the person now, as the chat's own bar reads
 *  them. Pure. */
export function askingIds(all: readonly ChatMessage[]): Set<string> {
  const ids = [setupWaits(all)?.message.id, takeWaits(all)?.id, photoWaits(all)?.id, answerWaits(all) ? all.at(-1)?.id : undefined];
  return new Set(ids.filter((id): id is string => !!id));
}

export default function HostChatRow({ chatId, name, message, all, onOpen }: {
  chatId: string;
  name: string;
  message: ChatMessage;
  /** The chat's own messages, to know which ones still ask. */
  all: readonly ChatMessage[];
  /** The chat as it is today. */
  onOpen: () => void;
}) {
  const [full, setFull] = useState<string | null>(null);
  const row = <ChatRow chatId={chatId} message={message} onPhoto={setFull} sentLine={SENT} name={name} />;
  return (
    <>
      {askingIds(all).has(message.id) ? (
        <div
          data-host-asks={message.id}
          role="button"
          tabIndex={0}
          className="flex cursor-pointer flex-col"
          onClick={(e) => {
            // Its own controls (a voice's play, "Read it") stay its own.
            if ((e.target as Element).closest("button, a, audio")) return;
            onOpen();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onOpen();
          }}
        >
          {row}
        </div>
      ) : (
        row
      )}
      {full ? <PhotoFull src={full} onClose={() => setFull(null)} /> : null}
    </>
  );
}
