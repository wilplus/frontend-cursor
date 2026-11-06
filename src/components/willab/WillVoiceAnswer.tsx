"use client";

import { useRef, useState, type ReactNode } from "react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { postWillQuestionVoice } from "@/services/api/willQuestion";
import { NOT_NOW } from "@/lib/willab/leaveWords";
import { usePlanVoice } from "./plan/PlanDock";
import { TapRow, willWaiting, type WillQuestionTarget } from "./WillQuestion";

/* -------------------------------------------------------------------------- */
/*  A spoken answer to Will's question (backend N294 items 2 and 3, N296),    */
/*  as the thread keeps it: the speaker's bubble with the words Will heard.  */
/*  Since N483 Will's questions are answered with a tap or written words,    */
/*  except the key line, which asks to be said (backend N544): while it      */
/*  waits the bar's middle is "Record your answer", its tap records in the   */
/*  plan's small recording bar (N314), never the recording screens, and      */
/*  "Not now" under it gives the bar back to the next Take.                  */
/* -------------------------------------------------------------------------- */

/** Will's key-line question waiting for an answer (backend N294 item 2):
 *  the newest bubble drawn, else null. */
export function keyLineWaiting(
  drawn: readonly { metadata?: Record<string, unknown> | null }[],
): WillQuestionTarget | null {
  const target = willWaiting(drawn);
  const meta = drawn[drawn.length - 1]?.metadata;
  return target && meta?.will_question === "key_line" && meta?.will_question_step === "ask" ? target : null;
}

export type KeyLineHear = {
  /** The key line is open: no box for it, it is said (N544 item 1). */
  asks: boolean;
  /** "Record your answer" in the bar's middle, else null (after "Not now",
   *  while it is sent, or with no key line open). */
  hear: { onTap: () => void } | null;
  /** True while the answer is said: the recording bar stands in for the bar. */
  recording: boolean;
  bar: ReactNode;
  /** "Not now", the grey word under the question (N483 item 1). */
  notNow: ReactNode;
};

/** The key line said in the bar (backend N544): the plan's own small
 *  recording bar, then the answer through `/will-question/voice`, heard
 *  under the caller's processing authorization; `onSent` reads the thread
 *  again. "Not now" leaves it until the chat is opened again. */
export function useKeyLineHear({
  shown,
  held,
  onSending,
  onSent,
}: {
  shown: readonly { metadata?: Record<string, unknown> | null }[];
  held: boolean;
  onSending: (on: boolean) => void;
  onSent: () => Promise<void> | void;
}): KeyLineHear {
  const target = keyLineWaiting(shown);
  const key = target ? target.takeSessionId : null;
  const [left, setLeft] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const targetRef = useRef(target);
  targetRef.current = target;
  const voice = usePlanVoice({
    open: key !== null && key !== left && !held && !sending,
    onAnswer: async (audio, durationMs) => {
      const to = targetRef.current;
      if (!to) return;
      setSending(true);
      onSending(true);
      try {
        if (await postWillQuestionVoice(to.arcId, to.takeSessionId, audio, durationMs)) await onSent();
      } finally {
        setSending(false);
        onSending(false);
      }
    },
  });
  return {
    asks: key !== null,
    hear: voice.waiting,
    recording: voice.recording,
    bar: voice.bar,
    notNow: voice.waiting ? (
      <TapRow labels={[NOT_NOW]} onTap={() => setLeft(key)} dataAttr={{ "data-key-line-not-now": "" }} />
    ) : null,
  };
}

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
