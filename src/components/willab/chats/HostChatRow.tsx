"use client";

import { useState } from "react";
import type { ChatMessage } from "@/services/api/chats";
import { ChatRow, PhotoFull, SENT } from "./ChatThread";

/* -------------------------------------------------------------------------- */
/*  One of the host's chat's own messages, drawn among the Takes of a host's  */
/*  chat that takes Takes (backend N648 item 8), as the chat itself draws it  */
/*  (ChatRow): theirs grey on the left, mine orange on the right, a voice    */
/*  with "Read it", a photo full size on a tap.                               */
/* -------------------------------------------------------------------------- */

export default function HostChatRow({ chatId, name, message }: { chatId: string; name: string; message: ChatMessage }) {
  const [full, setFull] = useState<string | null>(null);
  return (
    <>
      <ChatRow chatId={chatId} message={message} onPhoto={setFull} sentLine={SENT} name={name} />
      {full ? <PhotoFull src={full} onClose={() => setFull(null)} /> : null}
    </>
  );
}
