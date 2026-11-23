"use client";

import { createPortal } from "react-dom";
import ChatComposer from "./chats/ChatComposer";
import { useInlineWalkHost } from "./walk/InlineWalkHost";

/** The strip's button, signed (the tempo step's word, N314). */
export const RECORDING_STOP = "Stop";
/** The trash's name, as the locked bar file has it (N483). */
export const THROW_IT_AWAY = "Throw it away";

export default function RecordingBar({
  elapsedMs,
  onTrash,
  onStop,
}: {
  elapsedMs: number;
  onTrash: () => void;
  /** Absent while the microphone is still opening: the strip shows no Stop
   *  yet (the tempo step). */
  onStop?: () => void;
}) {
  const host = useInlineWalkHost();
  const bar = (
    <div className="min-w-0 flex-1" data-recording-bar="">
      <ChatComposer voiceRequired recording={{ elapsedMs, stop: onStop, discard: onTrash, stopLabel: RECORDING_STOP }} />
    </div>
  );
  return host?.recordingDock ? createPortal(bar, host.recordingDock) : bar;
}
