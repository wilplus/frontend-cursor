"use client";

import type { LoungeMessage } from "@/services/api/loungeMessages";

/* -------------------------------------------------------------------------- */
/*  A spoken answer to Will's question (backend N294 items 2 and 3, N296),    */
/*  as the thread keeps it: the speaker's bubble with the words Will heard.  */
/*  Since N483 Will's question is answered with a tap or written words, so   */
/*  no new spoken answers are made here; the ones already said still show.  */
/* -------------------------------------------------------------------------- */

/** The speaker's voice answer to Will, in a row's metadata. */
export function isWillVoice(message: Pick<LoungeMessage, "role" | "metadata">): boolean {
  return message.role === "user" && message.metadata?.will_voice === true;
}

/** The speaker's voice answer to Will: the words he heard, on the speaker's
 *  side (N275). */
export function WillVoiceBubble({ message }: { message: Pick<LoungeMessage, "body"> }) {
  return (
    <div data-row="me" data-bubble="" data-will-voice="" className="ml-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2">
      <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.4] text-primary-foreground">{message.body}</div>
    </div>
  );
}
