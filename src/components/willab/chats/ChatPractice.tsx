"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { watchPaceStream, type PaceMic } from "@/lib/willab/pace/paceMic";
import { takeSessionOf } from "@/lib/willab/takeExchange";
import { coachMomentFromMetadata, type CoachMomentReference } from "@/services/api/coachMoment";
import { readPractiseOffered } from "@/services/api/consentChoices";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import CoachMoment, { RequestedAiAudio } from "../CoachMoment";
import PaceScale from "../pace/PaceScale";

type ChatPractice =
  | { tool: "sniper"; words: string }
  | { tool: "ai_audio"; words: string; retryId: string; guidance?: string }
  | { tool: "right_way"; words: string };

export function chatPractice(message: LoungeMessage): ChatPractice | null {
  const raw = message.metadata?.chat_practice;
  if (message.role !== "bot" || !raw || typeof raw !== "object") return null;
  const { words, tool, retry_message_id, guidance } = raw as Record<string, unknown>;
  if (typeof words !== "string" || !words.trim()) return null;
  if (tool === "sniper" || tool === "right_way") return { tool, words };
  if (tool === "ai_audio" && typeof retry_message_id === "string" && retry_message_id) {
    return { tool, words, retryId: retry_message_id, guidance: typeof guidance === "string" ? guidance : undefined };
  }
  return null;
}

type TakePracticeScope = { arcId: string; takeId: string };
type PracticeScope = string | false | TakePracticeScope;

function replyInScope(row: LoungeMessage, scope: PracticeScope | undefined) {
  if (typeof scope === "object") {
    return row.metadata?.arc_id === scope.arcId && takeSessionOf(row) === scope.takeId;
  }
  if (scope) return row.metadata?.arc_id === scope;
  return row.metadata?.place === "speaking" && !row.metadata?.arc_id && !row.metadata?.chat;
}

function latestReply(rows: readonly LoungeMessage[], scope: PracticeScope | undefined) {
  if (scope === false) return undefined;
  return rows.findLast((row) => row.role === "bot" && row.kind === "text" && replyInScope(row, scope));
}

export function useChatPractice(rows: readonly LoungeMessage[], scope?: PracticeScope) {
  const reply = latestReply(rows, scope);
  const reference = coachMomentFromMetadata(reply?.metadata?.coach_moment);
  const project = typeof scope === "object" ? scope.arcId : scope;
  const plan = reply && reference && (!project || project === reference.arc_id) ? chatPractice(reply) : null;
  const replyId = plan ? reply?.client_id : undefined;
  const sniperId = plan?.tool === "sniper" ? replyId : undefined;
  const [permittedSniper, setPermittedSniper] = useState<string>();
  const sniperReady = Boolean(sniperId && permittedSniper === sniperId);
  const [listening, setListening] = useState<string>();
  const [played, setPlayed] = useState<ReadonlySet<string>>(() => new Set());
  const value = useRef<number | null>(null);
  const activity = useCallback(() => value.current, []);
  useEffect(() => {
    if (!sniperId) {
      setPermittedSniper(undefined);
      return;
    }
    let current = true;
    void readPractiseOffered().then((allowed) => {
      if (current) setPermittedSniper(allowed ? sniperId : undefined);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [sniperId]);
  const audioReady = useCallback((id: string, ready: boolean) => {
    setPlayed((previous) => {
      if (previous.has(id) === ready) return previous;
      const next = new Set(previous);
      if (ready) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  function listen(stream: MediaStream) {
    if (!sniperReady || !replyId) return undefined;
    let active = true;
    let meter: PaceMic | null = null;
    value.current = null;
    setListening(replyId);
    void watchPaceStream(stream, (read) => { if (active) value.current = read.activity; })
      .then((started) => { if (active) meter = started; else started.stop(); })
      .catch(() => undefined);
    return () => {
      active = false;
      meter?.stop();
      value.current = null;
      setListening(undefined);
    };
  }

  return {
    replyId, ready: plan?.tool === "right_way" || sniperReady || Boolean(replyId && plan?.tool === "ai_audio" && played.has(replyId)),
    reference, listen, listening, activity, audioReady,
  };
}

export const ChatPracticeContext = createContext<ReturnType<typeof useChatPractice> | null>(null);

export function useSpeakingPractice(
  rows: readonly LoungeMessage[], place: string | null, room: string | null,
  citation: TakePracticeScope | null, reviewingHostedTake: boolean,
) {
  const scope = reviewingHostedTake && citation ? citation : place === "speaking" && !room && !citation ? undefined : false;
  return useChatPractice(rows, scope);
}

export function ChatPracticeReply({ plan, reference, replyId, project }: {
  plan: ChatPractice; reference: CoachMomentReference; replyId: string; project?: string;
}) {
  const capture = useContext(ChatPracticeContext);
  const audioReady = capture?.audioReady;
  const [playable, setPlayable] = useState(false);
  const onPlayable = useCallback((ready: boolean) => {
    setPlayable(ready);
    audioReady?.(replyId, ready);
  }, [audioReady, replyId]);
  const listening = capture?.listening === replyId;
  const clipOnly = useMemo(() => ({ ...reference, practise: false, intervention: undefined }), [reference]);
  return (
    <div data-coach-intervention={plan.tool} className="min-w-0 space-y-2">
      {plan.tool === "sniper" ? (
        <PaceScale label="Sniper" className="h-12 max-w-md" asleep={!listening}
          activity={listening && capture ? capture.activity : () => null} />
      ) : <>
        {playable && plan.guidance ? <p>{plan.guidance}</p> : null}
        <RequestedAiAudio reference={reference} existing={null} chatRetryId={plan.retryId}
          replyId={replyId} onPlayable={onPlayable} />
      </>}
      <p data-practice-words className="whitespace-pre-wrap">{plan.words}</p>
      {reference.playback === true ? <CoachMoment reference={clipOnly} project={project} /> : null}
    </div>
  );
}
