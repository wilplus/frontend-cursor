"use client";

import { ChatLink, ChatLinks } from "../WillQuestion";
import { OWN_CHAT_LINKS } from "../plan/WayIn";
import { WAY_IN_WORDS, linkLabel, rowLinks, wayInBeat } from "@/lib/willab/wayIn";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { CopyLinkLine } from "./JoinSetup";
import type { LoungePlace } from "./loungePlace";

/* -------------------------------------------------------------------------- */
/*  "Copy my link ›" and "Your questions for people who join ›" in Will's     */
/*  chat, with his lines (backend N636 item 3, N629): they are about one's    */
/*  own chat. They come on the way in's "You're set." row, a speaking row;    */
/*  the speaking chat leaves them off it and Will's chat draws them here,     */
/*  the same links, once that row has offered them. Only for the ring.        */
/* -------------------------------------------------------------------------- */

export default function OwnChatLinks({ place, messages, onJoinQuestions }: {
  place: LoungePlace | null;
  messages: readonly LoungeMessage[];
  onJoinQuestions: () => void;
}) {
  if (place !== "will") return null;
  const offered = new Set(
    messages.filter((m) => m.role !== "user" && wayInBeat(m) !== null).flatMap((m) => rowLinks(m).filter((l) => OWN_CHAT_LINKS.includes(l))),
  );
  if (offered.size === 0) return null;
  return (
    <ChatLinks>
      {offered.has(WAY_IN_WORDS.copyLink) ? <CopyLinkLine /> : null}
      {offered.has(WAY_IN_WORDS.joinQuestions) ? <ChatLink label={linkLabel(WAY_IN_WORDS.joinQuestions)} onClick={onJoinQuestions} /> : null}
    </ChatLinks>
  );
}
