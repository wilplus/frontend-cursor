"use client";

import { useRef } from "react";
import CoachVideo from "../CoachVideo";
import { CHUNK_SHEET_COPY as COPY } from "../idealEditCopy";
import { useBackDismiss } from "../useBackDismiss";
import WalkFooter from "./WalkFooter";
import WalkMessage from "./WalkMessage";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkStage from "./WalkStage";
import WalkThread, { WalkPart, WalkThreadMark } from "./WalkThread";

/* -------------------------------------------------------------------------- */
/*  CoachUpdateLens — the coach's changed word, opened from its "Later · from  */
/*  your coach" bubble (founder 2026-10-19, N80, D8; the approved two-phone   */
/*  prototype https://claude.ai/artifact/APk56PLZt6o6Cx9qUMKkuk, speaker lens */
/*  "bubble").                                                                */
/*                                                                            */
/*  Only the word: "Your coach" in the top bar with both arrows off, and ✕;   */
/*  the coach's wide bubble with their video when there is one, then their    */
/*  words (no "Your coach" line in it, no box when there is no video); the   */
/*  pill "Close" (lock 2026-10-12 §8). Close marks the word watched (onDone)  */
/*  and closes; ✕ and the device's Back only close, so the ring stays. It    */
/*  writes nothing to the chat and adds no words.                             */
/*                                                                            */
/*  Drawn as the walk's lens is now (founder 2026-10-20, N81, WalkThread):    */
/*  one chat of one part, opened by its mark "Your coach" (which the bar      */
/*  says, with ‹ › off as there is no other part), the bubble landing behind  */
/*  the typing dots, "Close" in the dock under it, ✕ the bar's. As the lens   */
/*  is since #882: the step at the top of the thread (WalkThread's room),     */
/*  and on a computer the Lounge's column with the lens's sizes (globals.css, */
/*  "The lens on a computer", data-coach-update-lens).                        */
/* -------------------------------------------------------------------------- */

type Shown = { key: "update"; overlay: boolean; text: string | null; videoUrl: string | null };

export default function CoachUpdateLens({
  open,
  text,
  videoUrl,
  onClose,
  onDone,
}: {
  open: boolean;
  text: string | null;
  videoUrl: string | null;
  /** ✕, Back, and after Close: the lens goes, the chat underneath. */
  onClose: () => void;
  /** Close: the speaker watched the word. */
  onDone: () => void;
}) {
  const screen: Shown = { key: "update", overlay: open, text, videoUrl };
  const frame = useRef<HTMLDivElement | null>(null);
  const done = () => {
    onDone();
    onClose();
  };
  return (
    <div data-walk-column data-coach-update-lens>
      <WalkStage
        screen={screen}
        className="z-[90]"
        render={(s, ghost) => (
          <WalkThread ghost={ghost} frame={frame} onClose={onClose}>
            <WalkThreadMark label={COPY.titleCoach} />
            <WalkPart now>
              <UpdateScreen shown={s} onClose={onClose} onDone={done} />
            </WalkPart>
          </WalkThread>
        )}
      />
      {open ? <BackCloses onClose={onClose} /> : null}
    </div>
  );
}

/** The device's Back closes the lens, as ✕ does. */
function BackCloses({ onClose }: { onClose: () => void }) {
  useBackDismiss(onClose);
  return null;
}

const OFF = () => undefined;

function UpdateScreen({ shown, onClose, onDone }: { shown: Shown; onClose: () => void; onDone: () => void }) {
  const nav: WalkNav = { position: COPY.titleCoach, index: 0, total: 1, onBack: OFF, onNext: OFF, backDisabled: true, nextDisabled: true };
  return (
    <WalkOverlay
      testId="walk-screen-update"
      nav={nav}
      onClose={onClose}
      footer={<WalkFooter pill={{ label: COPY.pillClose, onClick: onDone, testId: "walk-forward" }} />}
    >
      <WalkMessage coach wide>
        {shown.videoUrl ? <CoachVideo src={shown.videoUrl} className="my-2 w-full flex-none" /> : null}
        {shown.text ? <span>{shown.text}</span> : null}
      </WalkMessage>
    </WalkOverlay>
  );
}
