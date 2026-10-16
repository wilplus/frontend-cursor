"use client";

import { useEffect, useState } from "react";
import SnippetWavePlayer from "./SnippetWavePlayer";
import { WALK_COPY } from "./idealEditCopy";
import { noteAiVoicePlay, readAiVoice, type AiVoiceState } from "@/services/api/aiVoice";

/* -------------------------------------------------------------------------- */
/*  The AI version of your voice in the Lounge chat, lens off (founder lock    */
/*  2026-10-12, N71 section 3: "the lens and the chat show the same bubble"). */
/*  The walk's grey app bubble as a chat bubble: its lines, the label, the    */
/*  one player and under it the server's sentence on what changed and why    */
/*  (WIL-82, 2026-10-16); never plays by itself. The clip's link is fetched   */
/*  afresh (it expires); a clip that is gone (deleted, off) leaves the lines. */
/* -------------------------------------------------------------------------- */

const asked = new Map<string, Promise<AiVoiceState | null>>();

/** The clip's state, asked once per practice per page. */
function clipOf(practiceId: string): Promise<AiVoiceState | null> {
  let got = asked.get(practiceId);
  if (!got) {
    got = readAiVoice(practiceId)
      .then((r) => (r.ok ? r.data : null))
      .catch(() => null);
    asked.set(practiceId, got);
  }
  return got;
}

export function aiVoiceOfMeta(meta: Record<string, unknown>): { practiceId: string; then: string | null } | null {
  const raw = meta.ai_voice;
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.practice_id !== "string" || !v.practice_id) return null;
  return { practiceId: v.practice_id, then: typeof v.then === "string" && v.then ? v.then : null };
}

export default function LoungeAiVoiceBubble({
  body,
  practiceId,
  then,
  seed,
  avatar,
  onOpen,
}: {
  body: string;
  practiceId: string;
  then: string | null;
  seed: string;
  avatar: React.ReactNode;
  /** A tap on the words turns the lens back on, on this step. */
  onOpen?: () => void;
}) {
  const [clip, setClip] = useState<AiVoiceState["clip"]>(null);
  // An expired link is asked for afresh, once.
  const [renewed, setRenewed] = useState(false);
  useEffect(() => {
    let on = true;
    void clipOf(practiceId).then((s) => {
      if (on) setClip(s?.clip ?? null);
    });
    return () => {
      on = false;
    };
  }, [practiceId, renewed]);
  const renew = () => {
    if (renewed) return;
    asked.delete(practiceId);
    setRenewed(true);
  };

  const head = then && body.endsWith(`\n${then}`) ? body.slice(0, -(then.length + 1)) : body;
  const ready = clip?.state === "ready" && clip.url;
  const words = (text: string, className?: string) =>
    onOpen ? (
      <button type="button" data-walk-step-bubble onClick={onOpen} className={`whitespace-pre-wrap break-words text-left ${className ?? ""}`}>
        {text}
      </button>
    ) : (
      <span className={`whitespace-pre-wrap break-words ${className ?? ""}`}>{text}</span>
    );
  return (
    <div className="mr-auto flex max-w-[88%] items-end gap-1.5">
      {avatar}
      <div data-lounge-ai-voice className="flex min-w-0 flex-1 flex-col rounded-[16px] bg-muted px-3 py-2 text-[15px] leading-[1.45] text-foreground">
        {words(head)}
        {ready ? (
          <>
            <span className="mt-2 flex items-center gap-[7px] text-[13px] font-semibold">
              <span
                aria-hidden
                className="inline-flex h-[17px] w-[17px] items-center justify-center rounded-[5px] bg-foreground text-[9.5px] font-bold text-background"
              >
                {WALK_COPY.aiVoiceBadge}
              </span>
              {WALK_COPY.aiVoiceLabel}
            </span>
            <div className="mt-1.5" onClickCapture={() => void noteAiVoicePlay(practiceId)}>
              <SnippetWavePlayer
                seed={seed}
                src={clip.url as string}
                durationMs={clip.durationMs}
                size="compact"
                tone="ink"
                label={WALK_COPY.aiVoiceLabel}
                onError={renew}
              />
            </div>
            {clip.why ? (
              <span data-lounge-ai-why className="mt-2 whitespace-pre-wrap break-words">
                {clip.why}
              </span>
            ) : null}
          </>
        ) : null}
        {then ? words(then, "mt-2") : null}
      </div>
    </div>
  );
}
