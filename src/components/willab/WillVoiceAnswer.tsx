"use client";

import { useRef, useState, type ReactNode } from "react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { postWillVoiceAnswer } from "@/services/api/willQuestion";
import { useVoiceNote } from "./useVoiceNote";
import RecordingBar from "./RecordingBar";
import { PendingVoice } from "./plan/PlanRows";
import { VoicePlayer } from "./plan/VoicePlayer";
import { willWaiting, type WillQuestionTarget } from "./WillQuestion";

/* -------------------------------------------------------------------------- */
/*  Answering Will by voice (founder 2026-10-31, backend N294 items 2 and 3,   */
/*  N296 states 2 and 3, N314; N319 item 1).                                   */
/*                                                                            */
/*  While Will's question (or its follow-up) waits for an answer, the Lounge's */
/*  mic fills orange (colour only) for every speaker, the voice notebook or    */
/*  not. A tap records with the one recording bar: the trash, the walk's      */
/*  strip with Stop inside it; Stop sends. The answer shows at once as the    */
/*  speaker's voice bubble, playing from the phone, with the typing dots where */
/*  its words will be; the backend hears it under the processing              */
/*  authorization and writes the bubble with the words heard, Will's reply    */
/*  and what follows. The recording itself is not kept (the Lounge thread is  */
/*  text only): it plays back in this sitting, and the words stay.            */
/* -------------------------------------------------------------------------- */

/** This sitting's voice answers, by their row: the phone still has them. */
const played = new Map<string, { src: string; ms: number }>();

/** The speaker's voice answer to Will, in a row's metadata. */
export function isWillVoice(message: Pick<LoungeMessage, "role" | "metadata">): boolean {
  return message.role === "user" && message.metadata?.will_voice === true;
}

export function useWillVoice({
  shown,
  reload,
  onAnswered,
}: {
  /** The thread as drawn, oldest first: Will waits while his question is last. */
  shown: readonly Pick<LoungeMessage, "metadata">[];
  reload: () => Promise<unknown>;
  /** The speaker answered: the chat follows the newest bubble (N319 item 9). */
  onAnswered: () => void;
}): {
  /** Will waits and nothing is on its way: the mic records the answer. */
  waiting: { onTap: () => void } | null;
  /** The recording bar while the answer is said, in the message box's place. */
  bar: ReactNode;
  /** The answer on its way, at the bottom of the thread. */
  pending: ReactNode;
  composerDisplay: (base: string) => string;
} {
  const open = willWaiting(shown);
  const target = useRef<WillQuestionTarget | null>(null);
  const [sent, setSent] = useState<{ src: string; ms: number } | null>(null);
  const note = useVoiceNote({
    maxSeconds: 300,
    onDone: async ({ audio, durationMs }) => {
      const to = target.current;
      if (!to) return;
      const src = URL.createObjectURL(audio);
      setSent({ src, ms: durationMs });
      onAnswered();
      const rows = await postWillVoiceAnswer(to.arcId, to.takeSessionId, audio, durationMs);
      const mine = rows?.find((r) => r.metadata?.will_voice === true);
      if (mine) played.set(mine.client_id, { src, ms: durationMs });
      else URL.revokeObjectURL(src);
      try {
        if (rows) await reload();
      } finally {
        setSent(null);
        onAnswered();
      }
    },
  });
  const recording = note.phase === "recording";
  const idle = note.phase === "idle" && sent === null;
  return {
    waiting:
      open && idle
        ? {
            onTap: () => {
              target.current = open;
              void note.start();
            },
          }
        : null,
    bar: recording ? <RecordingBar elapsedMs={note.elapsedMs} onTrash={note.cancel} onStop={note.send} /> : null,
    pending: sent ? <PendingVoice src={sent.src} durationMs={sent.ms} /> : null,
    composerDisplay: (base) => (recording ? "hidden" : base),
  };
}

/** The speaker's voice answer to Will: the player while the phone still has
 *  the recording, and under it the words Will heard, as the plan's voice
 *  answers show them (N275). */
export function WillVoiceBubble({ message }: { message: Pick<LoungeMessage, "client_id" | "body" | "metadata"> }) {
  const local = played.get(message.client_id);
  const ms = typeof message.metadata?.duration_ms === "number" ? message.metadata.duration_ms : local?.ms;
  return (
    <div data-row="me" data-bubble="" data-will-voice="" className="ml-auto max-w-[85%] rounded-2xl bg-primary py-2 pl-2 pr-3">
      {local ? <VoicePlayer src={local.src} tone="orange" durationMs={ms ?? null} /> : null}
      <div className={`whitespace-pre-wrap break-words pl-1 text-[15px] leading-[1.4] text-primary-foreground ${local ? "mt-1.5" : ""}`}>
        {message.body}
      </div>
    </div>
  );
}
