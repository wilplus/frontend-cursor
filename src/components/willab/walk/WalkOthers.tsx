"use client";

import { useEffect, useRef, useState } from "react";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import WalkOverlay from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import WalkJudgement from "./WalkJudgement";
import WalkLoading from "./WalkLoading";
import { answerOtherClip, fetchOtherClips, type OtherClip } from "@/services/api/otherSpeakers";

/* -------------------------------------------------------------------------- */
/*  WalkOthers — judge other speakers, once, after practice (founder lock      */
/*  2026-10-12, moment and feedback chat, section 2.6).                        */
/*                                                                            */
/*  One moment per try, at least 1 and at most 3; none to judge, the walk     */
/*  goes on. The bridge line, the clip and the question in one bubble; big    */
/*  👍 Yes, 😐 In-between, 👎 No, and "Audio unclear" small. An answer moves   */
/*  on after the hold. Audio only, no number (AC-9).                          */
/* -------------------------------------------------------------------------- */

const PRIMARY = [
  { value: "yes", label: "👍 Yes" },
  { value: "in_between", label: "😐 In-between" },
  { value: "no", label: "👎 No" },
] as const;
const SECONDARY = [{ value: "audio_unclear", label: "Audio unclear" }] as const;

export default function WalkOthers({
  testId,
  count,
  skip,
  onDone,
  onClose,
}: {
  testId?: string;
  /** How many to judge: one per practise try, 1 to 3. */
  count: number;
  /** A guest or a replay judges nobody. */
  skip: boolean;
  onDone: () => void;
  onClose: () => void;
}) {
  const [clips, setClips] = useState<OtherClip[] | null>(null);
  const [at, setAt] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (skip) {
      done.current();
      return;
    }
    let live = true;
    void fetchOtherClips().then((list) => {
      if (!live) return;
      const mine = list.slice(0, Math.max(1, Math.min(3, count)));
      if (mine.length === 0) done.current();
      else setClips(mine);
    });
    return () => {
      live = false;
    };
  }, [skip, count]);

  const clip = clips?.[at];
  const nav = clips
    ? {
        position: `${WALK_COPY.othersTitle} · ${at + 1} ${COPY.pagerOf} ${clips.length}`,
        index: at,
        total: clips.length,
        onBack: () => setAt((i) => Math.max(0, i - 1)),
        onNext: () => (at + 1 < clips.length ? setAt(at + 1) : onDone()),
        backDisabled: at === 0,
      }
    : undefined;

  return (
    <WalkOverlay testId={testId} nav={nav} onClose={onClose}>
      {!clips || !clip ? (
        <WalkLoading />
      ) : (
        <>
          <WalkMessage>
            {at === 0 ? (
              <span>{clips.length === 1 ? WALK_COPY.othersOne : WALK_COPY.othersMany(clips.length)}</span>
            ) : null}
            <WalkPlayer
              key={clip.id}
              seed={`other-${clip.id}`}
              src={clip.src}
              startOffsetMs={clip.startOffsetMs}
              durationMs={clip.durationMs}
              label={nav?.position ?? WALK_COPY.othersTitle}
            />
            <span>{COPY.confidenceQuestion}</span>
          </WalkMessage>
          <WalkJudgement
            key={clip.id}
            question=""
            primary={PRIMARY}
            secondary={SECONDARY}
            onAnswer={(value) => {
              void answerOtherClip(clip.id, value);
              if (at + 1 < clips.length) setAt(at + 1);
              else onDone();
            }}
          />
        </>
      )}
    </WalkOverlay>
  );
}
