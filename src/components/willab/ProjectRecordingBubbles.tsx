"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import { readProcessingTake, type ProcessingTake } from "@/lib/willab/processingTake";
import { LetterCircle } from "./chats/ChatList";
import { TopBar } from "./chats/TopBar";
import { TypingGlyph } from "./TypingDots";
import ProcessingResumeOverlay from "./ProcessingResumeOverlay";
import { PROJECT_SPEAKER_BUBBLE } from "./walk/InlineWalkHost";
import type { PendingProjectTake } from "./usePendingProjectTakes";

export function RecordingProcessingBubble({ onOpen }: { onOpen: () => void }) {
  return <button type="button" data-processing-bubble onClick={onOpen}
    aria-haspopup="dialog"
    className="mr-auto flex min-h-11 max-w-[88%] items-center gap-2.5 rounded-[16px] bg-muted px-3 py-2 text-left text-[15px] leading-[1.45] text-foreground hover:bg-accent">
    <TypingGlyph />
    <span>Processing your recording</span>
    <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
  </button>;
}

export function PendingRecordingBubbles({ take, onOpen }: { take: PendingProjectTake; onOpen: () => void }) {
  const [audio, setAudio] = useState<string | null>(null);
  useEffect(() => {
    if (!take.audio || typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(take.audio);
    setAudio(url);
    return () => URL.revokeObjectURL(url);
  }, [take.audio]);

  return <>
    <div data-pending-project-recording={take.key}
      className={PROJECT_SPEAKER_BUBBLE + " ml-auto w-fit max-w-[86%] rounded-[18px] px-4 py-3"}>
      <p className="text-[15px] font-semibold">Your recording · Take {take.takeIndex}</p>
      {audio ? <audio controls preload="metadata" src={audio} aria-label="Your recording"
        className="mt-2 h-9 w-60 max-w-full" /> : null}
    </div>
    {take.error ? <p role="alert" className="mr-auto max-w-[88%] rounded-[16px] bg-muted px-3 py-2 text-sm">
      {take.error}
    </p> : <RecordingProcessingBubble onOpen={onOpen} />}
  </>;
}

export function PendingProjectChat({ take, onOpen }: { take?: PendingProjectTake; onOpen: (take: PendingProjectTake) => void }) {
  if (!take) return null;
  return <div data-pending-project-chat className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
    <TopBar circle={<LetterCircle id={take.key} name={take.topic} size={36} />} title={take.topic} />
    <div className="flex flex-1 flex-col justify-end overflow-y-auto px-4 py-4">
      <div className={WILLAB_CONTENT_RAIL + " flex flex-col gap-2"}>
        <PendingRecordingBubbles take={take} onOpen={() => onOpen(take)} />
      </div>
    </div>
  </div>;
}

/** The same processing screen follows the job when it moves into the chat. */
export function PendingProjectWait({ take, onClose }: { take: PendingProjectTake; onClose: () => void }) {
  const [marker, setMarker] = useState<ProcessingTake | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const { sessionId } = take;
    if (!sessionId) return;
    const sync = () => {
      const job = readProcessingTake(take.ownerId);
      if (job?.sessionId !== sessionId) return;
      if (job.status !== "processing") close.current();
      else setMarker(job);
    };
    sync();
    const timer = window.setInterval(sync, 500);
    return () => window.clearInterval(timer);
  }, [take.ownerId, take.sessionId]);

  return <ProcessingResumeOverlay progress={marker?.progress ?? null} phase={marker?.phase}
    cycleStartedAt={take.startedAt} phaseStartedAt={marker?.phaseStartedAt} onClose={onClose} />;
}
