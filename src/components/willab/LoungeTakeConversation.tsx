"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { fetchTrainings, type TrainingArc } from "@/services/api/trainings";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { isTakeExchangeMessage } from "@/lib/willab/takeExchange";
import TakeReview, { type ReviewExit, type ReviewFocus } from "./TakeReview";
import TakeConversationMessage from "./chats/TakeConversationMessage";
import { TakeConversation } from "./chats/TakeConversation";
import TypingDots from "./TypingDots";

export type TakeCitation = { arcId: string; takeId: string; focus?: ReviewFocus; quote?: string; takeIndex: number | null };

export default function LoungeTakeConversation({
  arcId, takeId, rows, chat, recordingDock, onCitation, onReload, renderFooter,
}: {
  arcId: string;
  takeId: string;
  rows: readonly LoungeMessage[];
  chat?: string;
  recordingDock: HTMLDivElement | null;
  onCitation: (citation: TakeCitation | null) => void;
  onReload: () => void;
  renderFooter?: (message: LoungeMessage) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState<TrainingArc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const exit = useRef<ReviewExit | null>(null);
  useEffect(() => {
    if (!open || loaded) return;
    let active = true;
    void fetchTrainings({ includeArchived: true }).then((projects) => {
      if (active) setProject(projects?.find((item) => item.arcId === arcId) ?? null);
    }).catch(() => undefined).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [open, loaded, arcId]);
  const take = project?.takes.find((item) => item.sessionId === takeId);
  const takeIndex = take?.takeIndex ??
    rows.map((row) => row.metadata?.take_index).find((n): n is number => typeof n === "number") ?? null;
  const preview = rows.find((row) => row.role === "bot" && isTakeExchangeMessage(row) && row.body.trim())?.body;

  function change(value: boolean) {
    const commit = () => {
      setOpen(value);
      onCitation(value ? { arcId, takeId, takeIndex } : null);
    };
    if (!value && exit.current) exit.current(commit);
    else commit();
  }

  return <TakeConversation title={takeIndex ? "Take " + takeIndex + " · Feedback walk" : "Feedback walk"}
    preview={preview} expanded={open} onExpandedChange={change}>
    {project && take ? <TakeReview project={project} target={{ take, focus: { step: "feedback" }, replay: true }}
      runs={[]} messages={rows} chat={chat} recordingDock={recordingDock} exitRef={exit}
      onClose={() => change(false)} onPracticeEnded={onReload} renderFooter={renderFooter}
      onAsk={({ focus, quote }) => onCitation({ arcId, takeId, takeIndex, focus, quote })} />
    : loaded ? rows.filter(isTakeExchangeMessage).map((message) =>
      <TakeConversationMessage key={message.client_id} message={message} project={arcId} recordingDock={recordingDock}
        footer={renderFooter?.(message)} replayOnly
        onRefer={(snippet, quote) => onCitation({ arcId, takeId, takeIndex, focus: { step: "feedback", snippet_id: snippet }, quote })} />,
    ) : <TypingDots label="Loading feedback" />}
  </TakeConversation>;
}
